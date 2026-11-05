-- ============================================================================
-- SCRIPT 15: Create Temporal Branching and Merge Schema Tables
-- Project: Time Travel Database System
-- Target: Oracle Database 21c XE
-- Description: GitHub-inspired temporal branching, branch-specific commits,
--              changesets, and three-way merge history tracking.
-- ============================================================================

-- Safe cleanup for re-installation
BEGIN
    EXECUTE IMMEDIATE 'DROP TABLE TT_BRANCH_MERGE_HISTORY CASCADE CONSTRAINTS';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

BEGIN
    EXECUTE IMMEDIATE 'DROP TABLE TT_BRANCH_CHANGESET CASCADE CONSTRAINTS';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

BEGIN
    EXECUTE IMMEDIATE 'DROP TABLE TT_BRANCH_COMMITS CASCADE CONSTRAINTS';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

BEGIN
    EXECUTE IMMEDIATE 'DROP TABLE TT_BRANCHES CASCADE CONSTRAINTS';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

-- Sequences for branching system
DECLARE
    PROCEDURE drop_seq(p_name IN VARCHAR2) IS
    BEGIN
        EXECUTE IMMEDIATE 'DROP SEQUENCE ' || p_name;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
BEGIN
    drop_seq('TT_BRANCH_SEQ');
    drop_seq('TT_BRANCH_COMMIT_SEQ');
    drop_seq('TT_CHANGESET_SEQ');
    drop_seq('TT_MERGE_SEQ');
END;
/

CREATE SEQUENCE TT_BRANCH_SEQ START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE TT_BRANCH_COMMIT_SEQ START WITH 101 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE TT_CHANGESET_SEQ START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE TT_MERGE_SEQ START WITH 1 INCREMENT BY 1 NOCACHE;

-- 1. TT_BRANCHES: Branch metadata & base origin
CREATE TABLE TT_BRANCHES (
    branch_id           NUMBER PRIMARY KEY,
    branch_name         VARCHAR2(100) NOT NULL UNIQUE,
    parent_branch_id    NUMBER REFERENCES TT_BRANCHES(branch_id),
    base_commit_id      VARCHAR2(64),
    base_timestamp      TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    created_by          VARCHAR2(100) DEFAULT SYS_CONTEXT('USERENV', 'SESSION_USER'),
    branch_status       VARCHAR2(20) DEFAULT 'ACTIVE' NOT NULL 
                        CHECK (branch_status IN ('ACTIVE', 'MERGED', 'DELETED')),
    is_default          NUMBER(1) DEFAULT 0 NOT NULL CHECK (is_default IN (0, 1)),
    description         VARCHAR2(500)
);

-- 2. TT_BRANCH_COMMITS: Immutable Git-like commit ledger
CREATE TABLE TT_BRANCH_COMMITS (
    commit_id               VARCHAR2(64) PRIMARY KEY,
    branch_id               NUMBER NOT NULL REFERENCES TT_BRANCHES(branch_id) ON DELETE CASCADE,
    parent_commit_id        VARCHAR2(64) REFERENCES TT_BRANCH_COMMITS(commit_id),
    commit_message          VARCHAR2(500) NOT NULL,
    commit_timestamp        TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    commit_order_seq        NUMBER NOT NULL,
    author                  VARCHAR2(100) DEFAULT SYS_CONTEXT('USERENV', 'SESSION_USER') NOT NULL,
    commit_type             VARCHAR2(20) DEFAULT 'NORMAL' NOT NULL 
                            CHECK (commit_type IN ('INITIAL', 'NORMAL', 'MERGE', 'FAST_FORWARD')),
    merge_parent_commit_id  VARCHAR2(64) REFERENCES TT_BRANCH_COMMITS(commit_id)
);

-- 3. TT_BRANCH_CHANGESET: Fine-grained record mutations within a commit
CREATE TABLE TT_BRANCH_CHANGESET (
    changeset_id        NUMBER PRIMARY KEY,
    commit_id           VARCHAR2(64) NOT NULL REFERENCES TT_BRANCH_COMMITS(commit_id) ON DELETE CASCADE,
    table_name          VARCHAR2(60) NOT NULL,
    record_id           VARCHAR2(255) NOT NULL,
    operation_type      VARCHAR2(10) NOT NULL 
                        CHECK (operation_type IN ('INSERT', 'UPDATE', 'DELETE')),
    before_values       CLOB,
    after_values        CLOB,
    delta_values        CLOB,
    changed_columns     VARCHAR2(500),
    CONSTRAINT chk_bcs_before CHECK (before_values IS NULL OR before_values IS JSON),
    CONSTRAINT chk_bcs_after CHECK (after_values IS NULL OR after_values IS JSON),
    CONSTRAINT chk_bcs_delta CHECK (delta_values IS NULL OR delta_values IS JSON)
);

-- 4. TT_BRANCH_MERGE_HISTORY: Three-way merge tracking & audit log
CREATE TABLE TT_BRANCH_MERGE_HISTORY (
    merge_id            NUMBER PRIMARY KEY,
    source_branch_id    NUMBER NOT NULL REFERENCES TT_BRANCHES(branch_id),
    target_branch_id    NUMBER NOT NULL REFERENCES TT_BRANCHES(branch_id),
    source_commit_id    VARCHAR2(64) NOT NULL,
    target_commit_id    VARCHAR2(64) NOT NULL,
    merge_commit_id     VARCHAR2(64) REFERENCES TT_BRANCH_COMMITS(commit_id),
    merge_status        VARCHAR2(20) NOT NULL 
                        CHECK (merge_status IN ('SUCCESS', 'CONFLICT', 'ABORTED', 'FAST_FORWARD')),
    merge_timestamp     TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    conflicts_count     NUMBER DEFAULT 0 NOT NULL,
    merge_message       VARCHAR2(500),
    conflict_details    CLOB,
    CONSTRAINT chk_bmh_conflicts CHECK (conflict_details IS NULL OR conflict_details IS JSON)
);

-- Indexes for fast commit traversal, diffing, and branch state reconstruction
CREATE INDEX IDX_TT_COMMITS_BRANCH ON TT_BRANCH_COMMITS(branch_id, commit_order_seq);
CREATE INDEX IDX_TT_COMMITS_PARENT ON TT_BRANCH_COMMITS(parent_commit_id);
CREATE INDEX IDX_TT_COMMITS_MERGEP ON TT_BRANCH_COMMITS(merge_parent_commit_id);
CREATE INDEX IDX_TT_CHANGESET_COMMIT ON TT_BRANCH_CHANGESET(commit_id);
CREATE INDEX IDX_TT_CHANGESET_LOOKUP ON TT_BRANCH_CHANGESET(table_name, record_id);
CREATE INDEX IDX_TT_MERGE_STATUS ON TT_BRANCH_MERGE_HISTORY(merge_status, merge_timestamp);

-- Seed default 'main' branch and initial baseline commit
DECLARE
    v_main_id NUMBER;
    v_init_commit_id VARCHAR2(64) := 'c-main-init';
    v_now TIMESTAMP WITH TIME ZONE := SYSTIMESTAMP;
BEGIN
    v_main_id := TT_BRANCH_SEQ.NEXTVAL;
    
    INSERT INTO TT_BRANCHES (
        branch_id, branch_name, parent_branch_id, base_commit_id,
        base_timestamp, created_at, created_by, branch_status, is_default, description
    ) VALUES (
        v_main_id, 'main', NULL, NULL,
        v_now, v_now, 'SYSTEM', 'ACTIVE', 1, 'Production default database branch'
    );

    INSERT INTO TT_BRANCH_COMMITS (
        commit_id, branch_id, parent_commit_id, commit_message,
        commit_timestamp, commit_order_seq, author, commit_type, merge_parent_commit_id
    ) VALUES (
        v_init_commit_id, v_main_id, NULL, 'Initial baseline from production database',
        v_now, TT_COMMIT_SEQ.NEXTVAL, 'SYSTEM', 'INITIAL', NULL
    );

    UPDATE TT_BRANCHES
    SET base_commit_id = v_init_commit_id
    WHERE branch_id = v_main_id;

    COMMIT;
END;
/

