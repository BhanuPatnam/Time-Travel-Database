-- ============================================================================
-- SCRIPT 04: Create Change-Capture Database Triggers
-- Project: Time Travel Database System
-- Target: Oracle Database 21c XE
-- Description: Captures INSERT, UPDATE, DELETE in atomic same-transaction history log
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CUSTOMERS Triggers
-- ----------------------------------------------------------------------------
CREATE OR REPLACE TRIGGER TRG_CUSTOMERS_BI
BEFORE INSERT ON CUSTOMERS
FOR EACH ROW
BEGIN
    IF :NEW.customer_id IS NULL THEN
        :NEW.customer_id := CUSTOMER_ID_SEQ.NEXTVAL;
    END IF;
    IF :NEW.created_at IS NULL THEN
        :NEW.created_at := SYSTIMESTAMP;
    END IF;
    IF :NEW.updated_at IS NULL THEN
        :NEW.updated_at := SYSTIMESTAMP;
    END IF;
END;
/

CREATE OR REPLACE TRIGGER TRG_CUSTOMERS_BU
BEFORE UPDATE ON CUSTOMERS
FOR EACH ROW
BEGIN
    :NEW.updated_at := SYSTIMESTAMP;
END;
/

CREATE OR REPLACE TRIGGER TRG_CUSTOMERS_HISTORY
AFTER INSERT OR UPDATE OR DELETE ON CUSTOMERS
FOR EACH ROW
DECLARE
    v_old_json CLOB := NULL;
    v_new_json CLOB := NULL;
    v_changed_cols VARCHAR2(500) := '';
BEGIN
    IF INSERTING THEN
        v_new_json := TT_CORE_PKG.customer_to_json(
            :NEW.customer_id, :NEW.name, :NEW.email, :NEW.phone,
            :NEW.status, :NEW.credit_limit, :NEW.created_at, :NEW.updated_at
        );
        TT_CORE_PKG.log_change(
            'CUSTOMERS', TO_CHAR(:NEW.customer_id), 'INSERT',
            NULL, v_new_json, 'ALL'
        );
    ELSIF UPDATING THEN
        v_old_json := TT_CORE_PKG.customer_to_json(
            :OLD.customer_id, :OLD.name, :OLD.email, :OLD.phone,
            :OLD.status, :OLD.credit_limit, :OLD.created_at, :OLD.updated_at
        );
        v_new_json := TT_CORE_PKG.customer_to_json(
            :NEW.customer_id, :NEW.name, :NEW.email, :NEW.phone,
            :NEW.status, :NEW.credit_limit, :NEW.created_at, :NEW.updated_at
        );

        IF :OLD.name != :NEW.name THEN v_changed_cols := v_changed_cols || 'name,'; END IF;
        IF :OLD.email != :NEW.email THEN v_changed_cols := v_changed_cols || 'email,'; END IF;
        IF NVL(:OLD.phone, '~') != NVL(:NEW.phone, '~') THEN v_changed_cols := v_changed_cols || 'phone,'; END IF;
        IF :OLD.status != :NEW.status THEN v_changed_cols := v_changed_cols || 'status,'; END IF;
        IF :OLD.credit_limit != :NEW.credit_limit THEN v_changed_cols := v_changed_cols || 'credit_limit,'; END IF;

        TT_CORE_PKG.log_change(
            'CUSTOMERS', TO_CHAR(:NEW.customer_id), 'UPDATE',
            v_old_json, v_new_json, RTRIM(v_changed_cols, ',')
        );
    ELSIF DELETING THEN
        v_old_json := TT_CORE_PKG.customer_to_json(
            :OLD.customer_id, :OLD.name, :OLD.email, :OLD.phone,
            :OLD.status, :OLD.credit_limit, :OLD.created_at, :OLD.updated_at
        );
        TT_CORE_PKG.log_change(
            'CUSTOMERS', TO_CHAR(:OLD.customer_id), 'DELETE',
            v_old_json, NULL, NULL
        );
    END IF;
END;
/

-- ----------------------------------------------------------------------------
-- 2. PRODUCTS Triggers
-- ----------------------------------------------------------------------------
CREATE OR REPLACE TRIGGER TRG_PRODUCTS_BI
BEFORE INSERT ON PRODUCTS
FOR EACH ROW
BEGIN
    IF :NEW.product_id IS NULL THEN
        :NEW.product_id := PRODUCT_ID_SEQ.NEXTVAL;
    END IF;
    IF :NEW.created_at IS NULL THEN
        :NEW.created_at := SYSTIMESTAMP;
    END IF;
    IF :NEW.updated_at IS NULL THEN
        :NEW.updated_at := SYSTIMESTAMP;
    END IF;
END;
/

CREATE OR REPLACE TRIGGER TRG_PRODUCTS_BU
BEFORE UPDATE ON PRODUCTS
FOR EACH ROW
BEGIN
    :NEW.updated_at := SYSTIMESTAMP;
END;
/

CREATE OR REPLACE TRIGGER TRG_PRODUCTS_HISTORY
AFTER INSERT OR UPDATE OR DELETE ON PRODUCTS
FOR EACH ROW
DECLARE
    v_old_json CLOB := NULL;
    v_new_json CLOB := NULL;
    v_changed_cols VARCHAR2(500) := '';
BEGIN
    IF INSERTING THEN
        v_new_json := TT_CORE_PKG.product_to_json(
            :NEW.product_id, :NEW.sku, :NEW.name, :NEW.category,
            :NEW.unit_price, :NEW.stock_quantity, :NEW.created_at, :NEW.updated_at
        );
        TT_CORE_PKG.log_change(
            'PRODUCTS', TO_CHAR(:NEW.product_id), 'INSERT',
            NULL, v_new_json, 'ALL'
        );
    ELSIF UPDATING THEN
        v_old_json := TT_CORE_PKG.product_to_json(
            :OLD.product_id, :OLD.sku, :OLD.name, :OLD.category,
            :OLD.unit_price, :OLD.stock_quantity, :OLD.created_at, :OLD.updated_at
        );
        v_new_json := TT_CORE_PKG.product_to_json(
            :NEW.product_id, :NEW.sku, :NEW.name, :NEW.category,
            :NEW.unit_price, :NEW.stock_quantity, :NEW.created_at, :NEW.updated_at
        );

        IF :OLD.sku != :NEW.sku THEN v_changed_cols := v_changed_cols || 'sku,'; END IF;
        IF :OLD.name != :NEW.name THEN v_changed_cols := v_changed_cols || 'name,'; END IF;
        IF :OLD.category != :NEW.category THEN v_changed_cols := v_changed_cols || 'category,'; END IF;
        IF :OLD.unit_price != :NEW.unit_price THEN v_changed_cols := v_changed_cols || 'unit_price,'; END IF;
        IF :OLD.stock_quantity != :NEW.stock_quantity THEN v_changed_cols := v_changed_cols || 'stock_quantity,'; END IF;

        TT_CORE_PKG.log_change(
            'PRODUCTS', TO_CHAR(:NEW.product_id), 'UPDATE',
            v_old_json, v_new_json, RTRIM(v_changed_cols, ',')
        );
    ELSIF DELETING THEN
        v_old_json := TT_CORE_PKG.product_to_json(
            :OLD.product_id, :OLD.sku, :OLD.name, :OLD.category,
            :OLD.unit_price, :OLD.stock_quantity, :OLD.created_at, :OLD.updated_at
        );
        TT_CORE_PKG.log_change(
            'PRODUCTS', TO_CHAR(:OLD.product_id), 'DELETE',
            v_old_json, NULL, NULL
        );
    END IF;
END;
/

-- ----------------------------------------------------------------------------
-- 3. ORDERS Triggers
-- ----------------------------------------------------------------------------
CREATE OR REPLACE TRIGGER TRG_ORDERS_BI
BEFORE INSERT ON ORDERS
FOR EACH ROW
BEGIN
    IF :NEW.order_id IS NULL THEN
        :NEW.order_id := ORDER_ID_SEQ.NEXTVAL;
    END IF;
    IF :NEW.order_date IS NULL THEN
        :NEW.order_date := SYSTIMESTAMP;
    END IF;
    IF :NEW.updated_at IS NULL THEN
        :NEW.updated_at := SYSTIMESTAMP;
    END IF;
END;
/

CREATE OR REPLACE TRIGGER TRG_ORDERS_BU
BEFORE UPDATE ON ORDERS
FOR EACH ROW
BEGIN
    :NEW.updated_at := SYSTIMESTAMP;
END;
/

CREATE OR REPLACE TRIGGER TRG_ORDERS_HISTORY
AFTER INSERT OR UPDATE OR DELETE ON ORDERS
FOR EACH ROW
DECLARE
    v_old_json CLOB := NULL;
    v_new_json CLOB := NULL;
    v_changed_cols VARCHAR2(500) := '';
BEGIN
    IF INSERTING THEN
        v_new_json := TT_CORE_PKG.order_to_json(
            :NEW.order_id, :NEW.customer_id, :NEW.order_date,
            :NEW.status, :NEW.total_amount, :NEW.notes, :NEW.updated_at
        );
        TT_CORE_PKG.log_change(
            'ORDERS', TO_CHAR(:NEW.order_id), 'INSERT',
            NULL, v_new_json, 'ALL'
        );
    ELSIF UPDATING THEN
        v_old_json := TT_CORE_PKG.order_to_json(
            :OLD.order_id, :OLD.customer_id, :OLD.order_date,
            :OLD.status, :OLD.total_amount, :OLD.notes, :OLD.updated_at
        );
        v_new_json := TT_CORE_PKG.order_to_json(
            :NEW.order_id, :NEW.customer_id, :NEW.order_date,
            :NEW.status, :NEW.total_amount, :NEW.notes, :NEW.updated_at
        );

        IF :OLD.status != :NEW.status THEN v_changed_cols := v_changed_cols || 'status,'; END IF;
        IF :OLD.total_amount != :NEW.total_amount THEN v_changed_cols := v_changed_cols || 'total_amount,'; END IF;
        IF NVL(:OLD.notes, '~') != NVL(:NEW.notes, '~') THEN v_changed_cols := v_changed_cols || 'notes,'; END IF;

        TT_CORE_PKG.log_change(
            'ORDERS', TO_CHAR(:NEW.order_id), 'UPDATE',
            v_old_json, v_new_json, RTRIM(v_changed_cols, ',')
        );
    ELSIF DELETING THEN
        v_old_json := TT_CORE_PKG.order_to_json(
            :OLD.order_id, :OLD.customer_id, :OLD.order_date,
            :OLD.status, :OLD.total_amount, :OLD.notes, :OLD.updated_at
        );
        TT_CORE_PKG.log_change(
            'ORDERS', TO_CHAR(:OLD.order_id), 'DELETE',
            v_old_json, NULL, NULL
        );
    END IF;
END;
/

-- ----------------------------------------------------------------------------
-- 4. ORDER_ITEMS Triggers
-- ----------------------------------------------------------------------------
CREATE OR REPLACE TRIGGER TRG_ORDER_ITEMS_BI
BEFORE INSERT ON ORDER_ITEMS
FOR EACH ROW
BEGIN
    IF :NEW.item_id IS NULL THEN
        :NEW.item_id := ORDER_ITEM_ID_SEQ.NEXTVAL;
    END IF;
END;
/

CREATE OR REPLACE TRIGGER TRG_ORDER_ITEMS_HISTORY
AFTER INSERT OR UPDATE OR DELETE ON ORDER_ITEMS
FOR EACH ROW
DECLARE
    v_old_json CLOB := NULL;
    v_new_json CLOB := NULL;
    v_changed_cols VARCHAR2(500) := '';
BEGIN
    IF INSERTING THEN
        v_new_json := TT_CORE_PKG.order_item_to_json(
            :NEW.item_id, :NEW.order_id, :NEW.product_id,
            :NEW.quantity, :NEW.unit_price, :NEW.subtotal
        );
        TT_CORE_PKG.log_change(
            'ORDER_ITEMS', TO_CHAR(:NEW.item_id), 'INSERT',
            NULL, v_new_json, 'ALL'
        );
    ELSIF UPDATING THEN
        v_old_json := TT_CORE_PKG.order_item_to_json(
            :OLD.item_id, :OLD.order_id, :OLD.product_id,
            :OLD.quantity, :OLD.unit_price, :OLD.subtotal
        );
        v_new_json := TT_CORE_PKG.order_item_to_json(
            :NEW.item_id, :NEW.order_id, :NEW.product_id,
            :NEW.quantity, :NEW.unit_price, :NEW.subtotal
        );

        IF :OLD.quantity != :NEW.quantity THEN v_changed_cols := v_changed_cols || 'quantity,'; END IF;
        IF :OLD.unit_price != :NEW.unit_price THEN v_changed_cols := v_changed_cols || 'unit_price,'; END IF;
        IF :OLD.subtotal != :NEW.subtotal THEN v_changed_cols := v_changed_cols || 'subtotal,'; END IF;

        TT_CORE_PKG.log_change(
            'ORDER_ITEMS', TO_CHAR(:NEW.item_id), 'UPDATE',
            v_old_json, v_new_json, RTRIM(v_changed_cols, ',')
        );
    ELSIF DELETING THEN
        v_old_json := TT_CORE_PKG.order_item_to_json(
            :OLD.item_id, :OLD.order_id, :OLD.product_id,
            :OLD.quantity, :OLD.unit_price, :OLD.subtotal
        );
        TT_CORE_PKG.log_change(
            'ORDER_ITEMS', TO_CHAR(:OLD.item_id), 'DELETE',
            v_old_json, NULL, NULL
        );
    END IF;
END;
/
