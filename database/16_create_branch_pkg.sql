-- ============================================================================
-- SCRIPT 16: Create Temporal Branching and Merge Engine Package (TT_BRANCH_PKG)
-- Project: Time Travel Database System
-- Target: Oracle Database 21c XE
-- Description: Authoritative PL/SQL implementation of Git-style branching,
--              branch commits, changesets, three-way diff, and conflict resolution.
-- ============================================================================

CREATE OR REPLACE PACKAGE TT_BRANCH_PKG AS
    -- Branch management
    FUNCTION create_branch(
        p_branch_name         IN VARCHAR2,
        p_parent_branch_name  IN VARCHAR2 DEFAULT 'main',
        p_base_timestamp      IN TIMESTAMP WITH TIME ZONE DEFAULT NULL,
        p_base_commit_id      IN VARCHAR2 DEFAULT NULL,
        p_created_by          IN VARCHAR2 DEFAULT 'developer',
        p_description         IN VARCHAR2 DEFAULT NULL
    ) RETURN NUMBER;

    FUNCTION list_branches RETURN CLOB;

    FUNCTION get_branch(p_branch_id_or_name IN VARCHAR2) RETURN CLOB;

    FUNCTION delete_branch(p_branch_id_or_name IN VARCHAR2) RETURN CLOB;

    -- Commit & Changeset management
    FUNCTION create_branch_commit(
        p_branch_id_or_name     IN VARCHAR2,
        p_message               IN VARCHAR2,
        p_author                IN VARCHAR2 DEFAULT 'developer',
        p_changes_json          IN CLOB DEFAULT NULL,
        p_parent_commit_id      IN VARCHAR2 DEFAULT NULL,
        p_commit_type           IN VARCHAR2 DEFAULT 'NORMAL',
        p_merge_parent_commit_id IN VARCHAR2 DEFAULT NULL
    ) RETURN VARCHAR2;

    FUNCTION get_branch_history(p_branch_id_or_name IN VARCHAR2) RETURN CLOB;

    FUNCTION get_branch_state(
        p_branch_id_or_name IN VARCHAR2,
        p_table_name        IN VARCHAR2 DEFAULT '__ALL__',
        p_commit_id         IN VARCHAR2 DEFAULT NULL
    ) RETURN CLOB;

    -- Comparison & Merge Engine
    FUNCTION compare_branches(
        p_base_branch     IN VARCHAR2,
        p_compare_branch  IN VARCHAR2
    ) RETURN CLOB;

    FUNCTION calculate_merge_base(
        p_source_branch IN VARCHAR2,
        p_target_branch IN VARCHAR2
    ) RETURN VARCHAR2;

    FUNCTION merge_branches(
        p_source_branch           IN VARCHAR2,
        p_target_branch           IN VARCHAR2,
        p_merge_message           IN VARCHAR2 DEFAULT NULL,
        p_author                  IN VARCHAR2 DEFAULT 'developer',
        p_resolution_strategy     IN VARCHAR2 DEFAULT 'AUTO',
        p_resolved_conflicts_json IN CLOB DEFAULT NULL
    ) RETURN CLOB;

    FUNCTION resolve_merge_conflict(
        p_merge_id          IN NUMBER,
        p_resolutions_json  IN CLOB,
        p_author            IN VARCHAR2 DEFAULT 'developer'
    ) RETURN CLOB;

    FUNCTION abort_merge(p_merge_id IN NUMBER) RETURN CLOB;
END TT_BRANCH_PKG;
/

CREATE OR REPLACE PACKAGE BODY TT_BRANCH_PKG AS

    -- Internal helper to resolve branch ID from ID or name
    FUNCTION resolve_branch_id(p_identifier IN VARCHAR2) RETURN NUMBER IS
        v_id NUMBER;
    BEGIN
        IF REGEXP_LIKE(TRIM(p_identifier), '^[0-9]+$') THEN
            SELECT branch_id INTO v_id 
            FROM TT_BRANCHES 
            WHERE branch_id = TO_NUMBER(p_identifier) AND branch_status != 'DELETED';
        ELSE
            SELECT branch_id INTO v_id 
            FROM TT_BRANCHES 
            WHERE LOWER(branch_name) = LOWER(TRIM(p_identifier)) AND branch_status != 'DELETED';
        END IF;
        RETURN v_id;
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            RAISE_APPLICATION_ERROR(-20101, 'Branch not found: ' || p_identifier);
    END resolve_branch_id;

    -- Internal helper to get head commit of a branch
    FUNCTION get_branch_head(p_branch_id IN NUMBER) RETURN VARCHAR2 IS
        v_commit_id VARCHAR2(64);
    BEGIN
        SELECT commit_id INTO v_commit_id
        FROM (
            SELECT commit_id 
            FROM TT_BRANCH_COMMITS 
            WHERE branch_id = p_branch_id 
            ORDER BY commit_order_seq DESC, commit_timestamp DESC
        ) WHERE ROWNUM = 1;
        RETURN v_commit_id;
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            RETURN NULL;
    END get_branch_head;

    -- 1. CREATE BRANCH
    FUNCTION create_branch(
        p_branch_name         IN VARCHAR2,
        p_parent_branch_name  IN VARCHAR2 DEFAULT 'main',
        p_base_timestamp      IN TIMESTAMP WITH TIME ZONE DEFAULT NULL,
        p_base_commit_id      IN VARCHAR2 DEFAULT NULL,
        p_created_by          IN VARCHAR2 DEFAULT 'developer',
        p_description         IN VARCHAR2 DEFAULT NULL
    ) RETURN NUMBER IS
        PRAGMA AUTONOMOUS_TRANSACTION;
        v_branch_id NUMBER;
        v_parent_id NUMBER := NULL;
        v_base_ts TIMESTAMP WITH TIME ZONE := p_base_timestamp;
        v_base_commit VARCHAR2(64) := p_base_commit_id;
        v_init_commit_id VARCHAR2(64);
        v_cnt NUMBER;
        v_author VARCHAR2(100) := NVL(p_created_by, 'developer');
    BEGIN
        IF TRIM(p_branch_name) IS NULL THEN
            RAISE_APPLICATION_ERROR(-20102, 'Branch name cannot be empty');
        END IF;

        -- Check duplicate
        SELECT COUNT(*) INTO v_cnt 
        FROM TT_BRANCHES 
        WHERE LOWER(branch_name) = LOWER(TRIM(p_branch_name)) AND branch_status != 'DELETED';
        IF v_cnt > 0 THEN
            RAISE_APPLICATION_ERROR(-20103, 'Branch already exists: ' || p_branch_name);
        END IF;

        -- Resolve parent branch
        IF p_parent_branch_name IS NOT NULL THEN
            BEGIN
                v_parent_id := resolve_branch_id(p_parent_branch_name);
            EXCEPTION WHEN OTHERS THEN
                v_parent_id := NULL;
            END IF;
        END IF;

        -- If parent exists and base commit not supplied, get parent's HEAD commit
        IF v_parent_id IS NOT NULL AND v_base_commit IS NULL THEN
            v_base_commit := get_branch_head(v_parent_id);
        END IF;

        -- Resolve base timestamp
        IF v_base_ts IS NULL THEN
            IF v_base_commit IS NOT NULL THEN
                SELECT commit_timestamp INTO v_base_ts
                FROM TT_BRANCH_COMMITS WHERE commit_id = v_base_commit;
            ELSE
                v_base_ts := SYSTIMESTAMP;
            END IF;
        END IF;

        v_branch_id := TT_BRANCH_SEQ.NEXTVAL;

        INSERT INTO TT_BRANCHES (
            branch_id, branch_name, parent_branch_id, base_commit_id,
            base_timestamp, created_at, created_by, branch_status, is_default, description
        ) VALUES (
            v_branch_id, TRIM(p_branch_name), v_parent_id, v_base_commit,
            v_base_ts, SYSTIMESTAMP, v_author, 'ACTIVE', 0, p_description
        );

        -- Create initial commit for the branch
        v_init_commit_id := 'c' || TT_BRANCH_COMMIT_SEQ.NEXTVAL;
        INSERT INTO TT_BRANCH_COMMITS (
            commit_id, branch_id, parent_commit_id, commit_message,
            commit_timestamp, commit_order_seq, author, commit_type, merge_parent_commit_id
        ) VALUES (
            v_init_commit_id, v_branch_id, v_base_commit,
            'Branch created from ' || NVL(p_parent_branch_name, 'main'),
            SYSTIMESTAMP, TT_COMMIT_SEQ.NEXTVAL, v_author, 'INITIAL', NULL
        );

        COMMIT;
        RETURN v_branch_id;
    EXCEPTION
        WHEN OTHERS THEN
            ROLLBACK;
            RAISE;
    END create_branch;

    -- 2. LIST BRANCHES
    FUNCTION list_branches RETURN CLOB IS
        v_result CLOB;
    BEGIN
        SELECT JSON_ARRAYAGG(
            JSON_OBJECT(
                'branch_id'        VALUE b.branch_id,
                'branch_name'      VALUE b.branch_name,
                'parent_branch_id' VALUE b.parent_branch_id,
                'parent_name'      VALUE p.branch_name,
                'base_commit_id'   VALUE b.base_commit_id,
                'base_timestamp'   VALUE TO_CHAR(b.base_timestamp, 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM'),
                'created_at'       VALUE TO_CHAR(b.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM'),
                'created_by'       VALUE b.created_by,
                'branch_status'    VALUE b.branch_status,
                'is_default'       VALUE (CASE WHEN b.is_default = 1 THEN 'Y' ELSE 'N' END),
                'description'      VALUE b.description,
                'commit_count'     VALUE (SELECT COUNT(*) FROM TT_BRANCH_COMMITS c WHERE c.branch_id = b.branch_id),
                'head_commit_id'   VALUE (
                    SELECT c2.commit_id FROM (
                        SELECT commit_id FROM TT_BRANCH_COMMITS 
                        WHERE branch_id = b.branch_id 
                        ORDER BY commit_order_seq DESC
                    ) c2 WHERE ROWNUM = 1
                ),
                'head_commit_message' VALUE (
                    SELECT c3.commit_message FROM (
                        SELECT commit_message FROM TT_BRANCH_COMMITS 
                        WHERE branch_id = b.branch_id 
                        ORDER BY commit_order_seq DESC
                    ) c3 WHERE ROWNUM = 1
                )
            ) ORDER BY b.is_default DESC, b.created_at ASC
            RETURNING CLOB
        ) INTO v_result
        FROM TT_BRANCHES b
        LEFT JOIN TT_BRANCHES p ON b.parent_branch_id = p.branch_id
        WHERE b.branch_status != 'DELETED';

        RETURN NVL(v_result, '[]');
    END list_branches;

    -- 3. GET BRANCH DETAILS
    FUNCTION get_branch(p_branch_id_or_name IN VARCHAR2) RETURN CLOB IS
        v_branch_id NUMBER;
        v_result CLOB;
    BEGIN
        v_branch_id := resolve_branch_id(p_branch_id_or_name);

        SELECT JSON_OBJECT(
            'branch_id'        VALUE b.branch_id,
            'branch_name'      VALUE b.branch_name,
            'parent_branch_id' VALUE b.parent_branch_id,
            'parent_name'      VALUE p.branch_name,
            'base_commit_id'   VALUE b.base_commit_id,
            'base_timestamp'   VALUE TO_CHAR(b.base_timestamp, 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM'),
            'created_at'       VALUE TO_CHAR(b.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM'),
            'created_by'       VALUE b.created_by,
            'branch_status'    VALUE b.branch_status,
            'is_default'       VALUE (CASE WHEN b.is_default = 1 THEN 'Y' ELSE 'N' END),
            'description'      VALUE b.description,
            'commit_count'     VALUE (SELECT COUNT(*) FROM TT_BRANCH_COMMITS c WHERE c.branch_id = b.branch_id)
            RETURNING CLOB
        ) INTO v_result
        FROM TT_BRANCHES b
        LEFT JOIN TT_BRANCHES p ON b.parent_branch_id = p.branch_id
        WHERE b.branch_id = v_branch_id;

        RETURN v_result;
    END get_branch;

    -- 4. DELETE BRANCH
    FUNCTION delete_branch(p_branch_id_or_name IN VARCHAR2) RETURN CLOB IS
        PRAGMA AUTONOMOUS_TRANSACTION;
        v_branch_id NUMBER;
        v_is_def NUMBER;
        v_name VARCHAR2(100);
    BEGIN
        v_branch_id := resolve_branch_id(p_branch_id_or_name);

        SELECT is_default, branch_name INTO v_is_def, v_name
        FROM TT_BRANCHES WHERE branch_id = v_branch_id;

        IF v_is_def = 1 THEN
            RAISE_APPLICATION_ERROR(-20104, 'Cannot delete the default branch (main)');
        END IF;

        UPDATE TT_BRANCHES
        SET branch_status = 'DELETED'
        WHERE branch_id = v_branch_id;

        COMMIT;
        RETURN JSON_OBJECT('status' VALUE 'DELETED', 'branch_id' VALUE v_branch_id, 'branch_name' VALUE v_name);
    EXCEPTION
        WHEN OTHERS THEN
            ROLLBACK;
            RAISE;
    END delete_branch;

    -- 5. CREATE BRANCH COMMIT
    FUNCTION create_branch_commit(
        p_branch_id_or_name     IN VARCHAR2,
        p_message               IN VARCHAR2,
        p_author                IN VARCHAR2 DEFAULT 'developer',
        p_changes_json          IN CLOB DEFAULT NULL,
        p_parent_commit_id      IN VARCHAR2 DEFAULT NULL,
        p_commit_type           IN VARCHAR2 DEFAULT 'NORMAL',
        p_merge_parent_commit_id IN VARCHAR2 DEFAULT NULL
    ) RETURN VARCHAR2 IS
        PRAGMA AUTONOMOUS_TRANSACTION;
        v_branch_id NUMBER;
        v_commit_id VARCHAR2(64);
        v_parent_id VARCHAR2(64) := p_parent_commit_id;
        v_order_seq NUMBER;
        v_cs_id NUMBER;
    BEGIN
        v_branch_id := resolve_branch_id(p_branch_id_or_name);

        IF TRIM(p_message) IS NULL THEN
            RAISE_APPLICATION_ERROR(-20105, 'Commit message cannot be empty');
        END IF;

        IF v_parent_id IS NULL THEN
            v_parent_id := get_branch_head(v_branch_id);
        END IF;

        v_commit_id := 'c' || TT_BRANCH_COMMIT_SEQ.NEXTVAL;
        v_order_seq := TT_COMMIT_SEQ.NEXTVAL;

        INSERT INTO TT_BRANCH_COMMITS (
            commit_id, branch_id, parent_commit_id, commit_message,
            commit_timestamp, commit_order_seq, author, commit_type, merge_parent_commit_id
        ) VALUES (
            v_commit_id, v_branch_id, v_parent_id, TRIM(p_message),
            SYSTIMESTAMP, v_order_seq, NVL(p_author, 'developer'),
            NVL(p_commit_type, 'NORMAL'), p_merge_parent_commit_id
        );

        -- Insert changesets if provided
        IF p_changes_json IS NOT NULL AND DBMS_LOB.GETLENGTH(p_changes_json) > 0 THEN
            INSERT INTO TT_BRANCH_CHANGESET (
                changeset_id, commit_id, table_name, record_id, operation_type,
                before_values, after_values, delta_values, changed_columns
            )
            SELECT 
                TT_CHANGESET_SEQ.NEXTVAL,
                v_commit_id,
                UPPER(jt.table_name),
                jt.record_id,
                UPPER(jt.operation_type),
                jt.before_values,
                jt.after_values,
                jt.delta_values,
                jt.changed_columns
            FROM JSON_TABLE(
                p_changes_json, '$[*]'
                COLUMNS (
                    table_name      VARCHAR2(60) PATH '$.table_name',
                    record_id       VARCHAR2(255) PATH '$.record_id',
                    operation_type  VARCHAR2(10)  PATH '$.operation_type',
                    before_values   CLOB FORMAT JSON PATH '$.before_values',
                    after_values    CLOB FORMAT JSON PATH '$.after_values',
                    delta_values    CLOB FORMAT JSON PATH '$.delta_values',
                    changed_columns VARCHAR2(500) PATH '$.changed_columns'
                )
            ) jt;
        END IF;

        COMMIT;
        RETURN v_commit_id;
    EXCEPTION
        WHEN OTHERS THEN
            ROLLBACK;
            RAISE;
    END create_branch_commit;

    -- 6. GET BRANCH HISTORY
    FUNCTION get_branch_history(p_branch_id_or_name IN VARCHAR2) RETURN CLOB IS
        v_branch_id NUMBER;
        v_result CLOB;
    BEGIN
        v_branch_id := resolve_branch_id(p_branch_id_or_name);

        SELECT JSON_ARRAYAGG(
            JSON_OBJECT(
                'commit_id'               VALUE c.commit_id,
                'branch_id'               VALUE c.branch_id,
                'parent_commit_id'        VALUE c.parent_commit_id,
                'commit_message'          VALUE c.commit_message,
                'commit_timestamp'        VALUE TO_CHAR(c.commit_timestamp, 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM'),
                'commit_order_seq'        VALUE c.commit_order_seq,
                'author'                  VALUE c.author,
                'commit_type'             VALUE c.commit_type,
                'merge_parent_commit_id'  VALUE c.merge_parent_commit_id,
                'changeset_count'         VALUE (SELECT COUNT(*) FROM TT_BRANCH_CHANGESET cs WHERE cs.commit_id = c.commit_id),
                'changes'                 VALUE (
                    SELECT JSON_ARRAYAGG(
                        JSON_OBJECT(
                            'changeset_id'    VALUE cs2.changeset_id,
                            'table_name'      VALUE cs2.table_name,
                            'record_id'       VALUE cs2.record_id,
                            'operation_type'  VALUE cs2.operation_type,
                            'changed_columns' VALUE cs2.changed_columns,
                            'before_values'   VALUE (CASE WHEN cs2.before_values IS NOT NULL THEN JSON_QUERY(cs2.before_values, '$') ELSE NULL END),
                            'after_values'    VALUE (CASE WHEN cs2.after_values IS NOT NULL THEN JSON_QUERY(cs2.after_values, '$') ELSE NULL END),
                            'delta_values'    VALUE (CASE WHEN cs2.delta_values IS NOT NULL THEN JSON_QUERY(cs2.delta_values, '$') ELSE NULL END)
                        ) RETURNING CLOB
                    ) FROM TT_BRANCH_CHANGESET cs2 WHERE cs2.commit_id = c.commit_id
                )
            ) ORDER BY c.commit_order_seq DESC
            RETURNING CLOB
        ) INTO v_result
        FROM TT_BRANCH_COMMITS c
        WHERE c.branch_id = v_branch_id;

        RETURN NVL(v_result, '[]');
    END get_branch_history;

    -- 7. CALCULATE MERGE BASE (Common ancestor commit)
    FUNCTION calculate_merge_base(
        p_source_branch IN VARCHAR2,
        p_target_branch IN VARCHAR2
    ) RETURN VARCHAR2 IS
        v_src_id NUMBER;
        v_tgt_id NUMBER;
        v_ancestor_commit VARCHAR2(64) := NULL;
    BEGIN
        v_src_id := resolve_branch_id(p_source_branch);
        v_tgt_id := resolve_branch_id(p_target_branch);

        -- Find the latest commit present in both source ancestry and target ancestry
        BEGIN
            WITH src_ancestors AS (
                SELECT commit_id, commit_order_seq, LEVEL as lvl
                FROM TT_BRANCH_COMMITS
                START WITH commit_id = get_branch_head(v_src_id)
                CONNECT BY PRIOR parent_commit_id = commit_id OR PRIOR merge_parent_commit_id = commit_id
            ),
            tgt_ancestors AS (
                SELECT commit_id, commit_order_seq, LEVEL as lvl
                FROM TT_BRANCH_COMMITS
                START WITH commit_id = get_branch_head(v_tgt_id)
                CONNECT BY PRIOR parent_commit_id = commit_id OR PRIOR merge_parent_commit_id = commit_id
            )
            SELECT s.commit_id INTO v_ancestor_commit
            FROM src_ancestors s
            JOIN tgt_ancestors t ON s.commit_id = t.commit_id
            ORDER BY s.commit_order_seq DESC
            FETCH FIRST 1 ROW ONLY;
        EXCEPTION WHEN NO_DATA_FOUND THEN
            -- Fallback to target branch base commit
            SELECT base_commit_id INTO v_ancestor_commit 
            FROM TT_BRANCHES WHERE branch_id = v_src_id;
        END;

        RETURN v_ancestor_commit;
    END calculate_merge_base;

    -- 8. GET BRANCH STATE (Returns active records for the branch)
    FUNCTION get_branch_state(
        p_branch_id_or_name IN VARCHAR2,
        p_table_name        IN VARCHAR2 DEFAULT '__ALL__',
        p_commit_id         IN VARCHAR2 DEFAULT NULL
    ) RETURN CLOB IS
        v_branch_id NUMBER;
        v_tbl VARCHAR2(60) := UPPER(TRIM(p_table_name));
        v_target_commit VARCHAR2(64) := p_commit_id;
        v_base_ts TIMESTAMP WITH TIME ZONE;
        v_base_json CLOB;
        v_result CLOB;
    BEGIN
        v_branch_id := resolve_branch_id(p_branch_id_or_name);

        IF v_target_commit IS NULL THEN
            v_target_commit := get_branch_head(v_branch_id);
        END IF;

        SELECT base_timestamp INTO v_base_ts
        FROM TT_BRANCHES WHERE branch_id = v_branch_id;

        -- We query changesets on this branch up to the requested commit
        SELECT JSON_OBJECT(
            'branch_id'      VALUE v_branch_id,
            'commit_id'      VALUE v_target_commit,
            'table_name'     VALUE v_tbl,
            'reconstructed_at' VALUE TO_CHAR(SYSTIMESTAMP, 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM'),
            'changes'        VALUE (
                SELECT JSON_ARRAYAGG(
                    JSON_OBJECT(
                        'changeset_id'    VALUE cs.changeset_id,
                        'commit_id'       VALUE cs.commit_id,
                        'table_name'      VALUE cs.table_name,
                        'record_id'       VALUE cs.record_id,
                        'operation_type'  VALUE cs.operation_type,
                        'changed_columns' VALUE cs.changed_columns,
                        'after_values'    VALUE (CASE WHEN cs.after_values IS NOT NULL THEN JSON_QUERY(cs.after_values, '$') ELSE NULL END)
                    ) RETURNING CLOB
                )
                FROM TT_BRANCH_CHANGESET cs
                JOIN TT_BRANCH_COMMITS c ON cs.commit_id = c.commit_id
                WHERE c.branch_id = v_branch_id
                  AND (v_tbl = '__ALL__' OR cs.table_name = v_tbl)
            )
            RETURNING CLOB
        ) INTO v_result
        FROM DUAL;

        RETURN v_result;
    END get_branch_state;

    -- 9. COMPARE BRANCHES
    FUNCTION compare_branches(
        p_base_branch     IN VARCHAR2,
        p_compare_branch  IN VARCHAR2
    ) RETURN CLOB IS
        v_base_id NUMBER;
        v_comp_id NUMBER;
        v_merge_base VARCHAR2(64);
        v_result CLOB;
    BEGIN
        v_base_id := resolve_branch_id(p_base_branch);
        v_comp_id := resolve_branch_id(p_compare_branch);
        v_merge_base := calculate_merge_base(p_compare_branch, p_base_branch);

        -- Collect changesets created in compare branch
        SELECT JSON_OBJECT(
            'base_branch'       VALUE p_base_branch,
            'compare_branch'    VALUE p_compare_branch,
            'merge_base_commit' VALUE v_merge_base,
            'total_changes'     VALUE (
                SELECT COUNT(*) 
                FROM TT_BRANCH_CHANGESET cs
                JOIN TT_BRANCH_COMMITS c ON cs.commit_id = c.commit_id
                WHERE c.branch_id = v_comp_id
            ),
            'added_count'       VALUE (
                SELECT COUNT(*) 
                FROM TT_BRANCH_CHANGESET cs
                JOIN TT_BRANCH_COMMITS c ON cs.commit_id = c.commit_id
                WHERE c.branch_id = v_comp_id AND cs.operation_type = 'INSERT'
            ),
            'modified_count'    VALUE (
                SELECT COUNT(*) 
                FROM TT_BRANCH_CHANGESET cs
                JOIN TT_BRANCH_COMMITS c ON cs.commit_id = c.commit_id
                WHERE c.branch_id = v_comp_id AND cs.operation_type = 'UPDATE'
            ),
            'deleted_count'     VALUE (
                SELECT COUNT(*) 
                FROM TT_BRANCH_CHANGESET cs
                JOIN TT_BRANCH_COMMITS c ON cs.commit_id = c.commit_id
                WHERE c.branch_id = v_comp_id AND cs.operation_type = 'DELETE'
            ),
            'changes'           VALUE (
                SELECT JSON_ARRAYAGG(
                    JSON_OBJECT(
                        'table_name'      VALUE cs.table_name,
                        'record_id'       VALUE cs.record_id,
                        'operation_type'  VALUE cs.operation_type,
                        'changed_columns' VALUE cs.changed_columns,
                        'commit_id'       VALUE cs.commit_id,
                        'before_values'   VALUE (CASE WHEN cs.before_values IS NOT NULL THEN JSON_QUERY(cs.before_values, '$') ELSE NULL END),
                        'after_values'    VALUE (CASE WHEN cs.after_values IS NOT NULL THEN JSON_QUERY(cs.after_values, '$') ELSE NULL END),
                        'delta_values'    VALUE (CASE WHEN cs.delta_values IS NOT NULL THEN JSON_QUERY(cs.delta_values, '$') ELSE NULL END)
                    ) RETURNING CLOB
                )
                FROM TT_BRANCH_CHANGESET cs
                JOIN TT_BRANCH_COMMITS c ON cs.commit_id = c.commit_id
                WHERE c.branch_id = v_comp_id
            )
            RETURNING CLOB
        ) INTO v_result
        FROM DUAL;

        RETURN v_result;
    END compare_branches;

    -- 10. MERGE BRANCHES (Three-way merge + conflict detection)
    FUNCTION merge_branches(
        p_source_branch           IN VARCHAR2,
        p_target_branch           IN VARCHAR2,
        p_merge_message           IN VARCHAR2 DEFAULT NULL,
        p_author                  IN VARCHAR2 DEFAULT 'developer',
        p_resolution_strategy     IN VARCHAR2 DEFAULT 'AUTO',
        p_resolved_conflicts_json IN CLOB DEFAULT NULL
    ) RETURN CLOB IS
        PRAGMA AUTONOMOUS_TRANSACTION;
        v_src_id NUMBER;
        v_tgt_id NUMBER;
        v_src_head VARCHAR2(64);
        v_tgt_head VARCHAR2(64);
        v_merge_base VARCHAR2(64);
        v_merge_id NUMBER;
        v_merge_commit_id VARCHAR2(64) := NULL;
        v_conflicts_count NUMBER := 0;
        v_conflicts_json CLOB := '[]';
        v_msg VARCHAR2(500);
        v_result CLOB;
    BEGIN
        v_src_id := resolve_branch_id(p_source_branch);
        v_tgt_id := resolve_branch_id(p_target_branch);
        v_src_head := get_branch_head(v_src_id);
        v_tgt_head := get_branch_head(v_tgt_id);
        v_merge_base := calculate_merge_base(p_source_branch, p_target_branch);

        v_merge_id := TT_MERGE_SEQ.NEXTVAL;
        v_msg := NVL(p_merge_message, 'Merge branch ' || p_source_branch || ' into ' || p_target_branch);

        -- Check Fast-Forward: If Target HEAD is the merge base, target hasn't diverged
        IF v_tgt_head = v_merge_base THEN
            -- Create Fast-Forward commit on target
            v_merge_commit_id := 'c' || TT_BRANCH_COMMIT_SEQ.NEXTVAL;
            INSERT INTO TT_BRANCH_COMMITS (
                commit_id, branch_id, parent_commit_id, commit_message,
                commit_timestamp, commit_order_seq, author, commit_type, merge_parent_commit_id
            ) VALUES (
                v_merge_commit_id, v_tgt_id, v_tgt_head,
                v_msg || ' (fast-forward)', SYSTIMESTAMP, TT_COMMIT_SEQ.NEXTVAL,
                NVL(p_author, 'developer'), 'FAST_FORWARD', v_src_head
            );

            -- Copy source changesets to target commit
            INSERT INTO TT_BRANCH_CHANGESET (
                changeset_id, commit_id, table_name, record_id, operation_type,
                before_values, after_values, delta_values, changed_columns
            )
            SELECT 
                TT_CHANGESET_SEQ.NEXTVAL, v_merge_commit_id, table_name, record_id, operation_type,
                before_values, after_values, delta_values, changed_columns
            FROM TT_BRANCH_CHANGESET cs
            JOIN TT_BRANCH_COMMITS c ON cs.commit_id = c.commit_id
            WHERE c.branch_id = v_src_id;

            INSERT INTO TT_BRANCH_MERGE_HISTORY (
                merge_id, source_branch_id, target_branch_id, source_commit_id, target_commit_id,
                merge_commit_id, merge_status, merge_timestamp, conflicts_count, merge_message
            ) VALUES (
                v_merge_id, v_src_id, v_tgt_id, v_src_head, v_tgt_head,
                v_merge_commit_id, 'FAST_FORWARD', SYSTIMESTAMP, 0, v_msg
            );

            COMMIT;
            RETURN JSON_OBJECT(
                'status'           VALUE 'SUCCESS',
                'merge_type'       VALUE 'FAST_FORWARD',
                'merge_id'         VALUE v_merge_id,
                'merge_commit_id'  VALUE v_merge_commit_id,
                'conflicts_count'  VALUE 0,
                'message'          VALUE 'Fast-forward merge successful'
            );
        END IF;

        -- Identify overlapping records modified in both source and target since merge base
        -- If any overlap exists on the same column with different values, register conflict
        SELECT COUNT(*),
               NVL(JSON_ARRAYAGG(
                   JSON_OBJECT(
                       'table_name'     VALUE s.table_name,
                       'record_id'      VALUE s.record_id,
                       'conflict_type'  VALUE (
                           CASE 
                               WHEN s.operation_type = 'DELETE' OR t.operation_type = 'DELETE' THEN 'DELETE_VS_UPDATE'
                               WHEN s.operation_type = 'INSERT' AND t.operation_type = 'INSERT' THEN 'CONCURRENT_INSERT'
                               ELSE 'SAME_COLUMN_MODIFICATION'
                           END
                       ),
                       'source_op'      VALUE s.operation_type,
                       'target_op'      VALUE t.operation_type,
                       'source_values'  VALUE (CASE WHEN s.after_values IS NOT NULL THEN JSON_QUERY(s.after_values, '$') ELSE NULL END),
                       'target_values'  VALUE (CASE WHEN t.after_values IS NOT NULL THEN JSON_QUERY(t.after_values, '$') ELSE NULL END)
                   ) RETURNING CLOB
               ), '[]')
        INTO v_conflicts_count, v_conflicts_json
        FROM TT_BRANCH_CHANGESET s
        JOIN TT_BRANCH_COMMITS sc ON s.commit_id = sc.commit_id
        JOIN TT_BRANCH_CHANGESET t ON s.table_name = t.table_name AND s.record_id = t.record_id
        JOIN TT_BRANCH_COMMITS tc ON t.commit_id = tc.commit_id
        WHERE sc.branch_id = v_src_id
          AND tc.branch_id = v_tgt_id
          AND (
              s.operation_type != t.operation_type 
              OR DBMS_LOB.COMPARE(s.after_values, t.after_values) != 0
          );

        -- If conflicts exist and resolutions are not provided, require user resolution
        IF v_conflicts_count > 0 AND p_resolved_conflicts_json IS NULL THEN
            INSERT INTO TT_BRANCH_MERGE_HISTORY (
                merge_id, source_branch_id, target_branch_id, source_commit_id, target_commit_id,
                merge_commit_id, merge_status, merge_timestamp, conflicts_count, merge_message, conflict_details
            ) VALUES (
                v_merge_id, v_src_id, v_tgt_id, v_src_head, v_tgt_head,
                NULL, 'CONFLICT', SYSTIMESTAMP, v_conflicts_count, v_msg, v_conflicts_json
            );
            COMMIT;

            SELECT JSON_OBJECT(
                'status'           VALUE 'CONFLICT',
                'merge_id'         VALUE v_merge_id,
                'conflicts_count'  VALUE v_conflicts_count,
                'conflicts'        VALUE JSON_QUERY(v_conflicts_json, '$'),
                'message'          VALUE 'Merge conflicts detected. Manual resolution required.'
                RETURNING CLOB
            ) INTO v_result FROM DUAL;
            RETURN v_result;
        END IF;

        -- Create standard 3-Way Merge Commit
        v_merge_commit_id := 'c' || TT_BRANCH_COMMIT_SEQ.NEXTVAL;
        INSERT INTO TT_BRANCH_COMMITS (
            commit_id, branch_id, parent_commit_id, commit_message,
            commit_timestamp, commit_order_seq, author, commit_type, merge_parent_commit_id
        ) VALUES (
            v_merge_commit_id, v_tgt_id, v_tgt_head,
            v_msg, SYSTIMESTAMP, TT_COMMIT_SEQ.NEXTVAL,
            NVL(p_author, 'developer'), 'MERGE', v_src_head
        );

        -- Apply non-conflicting source changes to target
        INSERT INTO TT_BRANCH_CHANGESET (
            changeset_id, commit_id, table_name, record_id, operation_type,
            before_values, after_values, delta_values, changed_columns
        )
        SELECT 
            TT_CHANGESET_SEQ.NEXTVAL, v_merge_commit_id, s.table_name, s.record_id, s.operation_type,
            s.before_values, s.after_values, s.delta_values, s.changed_columns
        FROM TT_BRANCH_CHANGESET s
        JOIN TT_BRANCH_COMMITS sc ON s.commit_id = sc.commit_id
        WHERE sc.branch_id = v_src_id;

        INSERT INTO TT_BRANCH_MERGE_HISTORY (
            merge_id, source_branch_id, target_branch_id, source_commit_id, target_commit_id,
            merge_commit_id, merge_status, merge_timestamp, conflicts_count, merge_message
        ) VALUES (
            v_merge_id, v_src_id, v_tgt_id, v_src_head, v_tgt_head,
            v_merge_commit_id, 'SUCCESS', SYSTIMESTAMP, 0, v_msg
        );

        COMMIT;
        RETURN JSON_OBJECT(
            'status'           VALUE 'SUCCESS',
            'merge_type'       VALUE 'THREE_WAY',
            'merge_id'         VALUE v_merge_id,
            'merge_commit_id'  VALUE v_merge_commit_id,
            'conflicts_count'  VALUE 0,
            'message'          VALUE 'Three-way merge completed successfully'
        );
    EXCEPTION
        WHEN OTHERS THEN
            ROLLBACK;
            RAISE;
    END merge_branches;

    -- 11. RESOLVE MERGE CONFLICT
    FUNCTION resolve_merge_conflict(
        p_merge_id          IN NUMBER,
        p_resolutions_json  IN CLOB,
        p_author            IN VARCHAR2 DEFAULT 'developer'
    ) RETURN CLOB IS
        PRAGMA AUTONOMOUS_TRANSACTION;
        v_src_id NUMBER;
        v_tgt_id NUMBER;
        v_src_head VARCHAR2(64);
        v_tgt_head VARCHAR2(64);
        v_msg VARCHAR2(500);
        v_merge_commit_id VARCHAR2(64);
    BEGIN
        SELECT source_branch_id, target_branch_id, source_commit_id, target_commit_id, merge_message
        INTO v_src_id, v_tgt_id, v_src_head, v_tgt_head, v_msg
        FROM TT_BRANCH_MERGE_HISTORY
        WHERE merge_id = p_merge_id AND merge_status = 'CONFLICT';

        v_merge_commit_id := 'c' || TT_BRANCH_COMMIT_SEQ.NEXTVAL;

        INSERT INTO TT_BRANCH_COMMITS (
            commit_id, branch_id, parent_commit_id, commit_message,
            commit_timestamp, commit_order_seq, author, commit_type, merge_parent_commit_id
        ) VALUES (
            v_merge_commit_id, v_tgt_id, v_tgt_head,
            NVL(v_msg, 'Resolved merge conflict'),
            SYSTIMESTAMP, TT_COMMIT_SEQ.NEXTVAL,
            NVL(p_author, 'developer'), 'MERGE', v_src_head
        );

        -- Insert user-resolved records as changesets
        IF p_resolutions_json IS NOT NULL THEN
            INSERT INTO TT_BRANCH_CHANGESET (
                changeset_id, commit_id, table_name, record_id, operation_type,
                before_values, after_values, delta_values, changed_columns
            )
            SELECT 
                TT_CHANGESET_SEQ.NEXTVAL,
                v_merge_commit_id,
                UPPER(jt.table_name),
                jt.record_id,
                UPPER(jt.operation_type),
                jt.before_values,
                jt.after_values,
                jt.delta_values,
                'resolved_conflict'
            FROM JSON_TABLE(
                p_resolutions_json, '$[*]'
                COLUMNS (
                    table_name      VARCHAR2(60) PATH '$.table_name',
                    record_id       VARCHAR2(255) PATH '$.record_id',
                    operation_type  VARCHAR2(10)  PATH '$.operation_type',
                    before_values   CLOB FORMAT JSON PATH '$.before_values',
                    after_values    CLOB FORMAT JSON PATH '$.after_values',
                    delta_values    CLOB FORMAT JSON PATH '$.delta_values'
                )
            ) jt;
        END IF;

        UPDATE TT_BRANCH_MERGE_HISTORY
        SET merge_status = 'SUCCESS',
            merge_commit_id = v_merge_commit_id
        WHERE merge_id = p_merge_id;

        COMMIT;
        RETURN JSON_OBJECT(
            'status'          VALUE 'SUCCESS',
            'merge_id'        VALUE p_merge_id,
            'merge_commit_id' VALUE v_merge_commit_id,
            'message'         VALUE 'Conflict resolved and merge commit created'
        );
    EXCEPTION
        WHEN OTHERS THEN
            ROLLBACK;
            RAISE;
    END resolve_merge_conflict;

    -- 12. ABORT MERGE
    FUNCTION abort_merge(p_merge_id IN NUMBER) RETURN CLOB IS
        PRAGMA AUTONOMOUS_TRANSACTION;
    BEGIN
        UPDATE TT_BRANCH_MERGE_HISTORY
        SET merge_status = 'ABORTED'
        WHERE merge_id = p_merge_id;

        COMMIT;
        RETURN JSON_OBJECT('status' VALUE 'ABORTED', 'merge_id' VALUE p_merge_id);
    EXCEPTION
        WHEN OTHERS THEN
            ROLLBACK;
            RAISE;
    END abort_merge;

END TT_BRANCH_PKG;
/

