-- ============================================================================
-- SCRIPT 03: Create Sequences
-- Project: Time Travel Database System
-- Target: Oracle Database 21c XE
-- Description: Sequences for business primary keys, transaction IDs, change IDs,
--              commit ordering, checkpoints, and benchmark metrics.
-- ============================================================================

-- Helper procedure to safely recreate a sequence
DECLARE
    PROCEDURE drop_seq(p_name IN VARCHAR2) IS
    BEGIN
        EXECUTE IMMEDIATE 'DROP SEQUENCE ' || p_name;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
BEGIN
    drop_seq('CUSTOMER_ID_SEQ');
    drop_seq('PRODUCT_ID_SEQ');
    drop_seq('ORDER_ID_SEQ');
    drop_seq('ORDER_ITEM_ID_SEQ');
    drop_seq('TT_TX_SEQ');
    drop_seq('TT_CHANGE_SEQ');
    drop_seq('TT_COMMIT_SEQ');
    drop_seq('TT_CHECKPOINT_SEQ');
    drop_seq('TT_CP_DATA_SEQ');
    drop_seq('TT_POLICY_DECISION_SEQ');
    drop_seq('TT_QUERY_METRICS_SEQ');
END;
/

-- Business Entity Sequences
CREATE SEQUENCE CUSTOMER_ID_SEQ START WITH 1001 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE PRODUCT_ID_SEQ  START WITH 2001 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE ORDER_ID_SEQ    START WITH 5001 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE ORDER_ITEM_ID_SEQ START WITH 10001 INCREMENT BY 1 NOCACHE;

-- Historical Engine Sequences
CREATE SEQUENCE TT_TX_SEQ START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE TT_CHANGE_SEQ START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE TT_COMMIT_SEQ START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE TT_CHECKPOINT_SEQ START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE TT_CP_DATA_SEQ START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE TT_POLICY_DECISION_SEQ START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE TT_QUERY_METRICS_SEQ START WITH 1 INCREMENT BY 1 NOCACHE;
