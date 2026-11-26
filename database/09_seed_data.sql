-- ============================================================================
-- SCRIPT 09: Seed Data and Workload Simulation
-- Project: Time Travel Database System
-- Target: Oracle Database 21c XE
-- Description: Seeds initial customers, products, orders, and simulates realistic
--              multi-phase business updates, deletes, and checkpoints.
-- ============================================================================

SET SERVEROUTPUT ON;

-- Clear previous test data safely without constraint or trigger conflicts
BEGIN
    -- 1. Temporarily disable triggers during cleanup to avoid spurious history entries
    BEGIN EXECUTE IMMEDIATE 'ALTER TRIGGER TRG_CUSTOMERS_HISTORY DISABLE'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN EXECUTE IMMEDIATE 'ALTER TRIGGER TRG_PRODUCTS_HISTORY DISABLE'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN EXECUTE IMMEDIATE 'ALTER TRIGGER TRG_ORDERS_HISTORY DISABLE'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN EXECUTE IMMEDIATE 'ALTER TRIGGER TRG_ORDER_ITEMS_HISTORY DISABLE'; EXCEPTION WHEN OTHERS THEN NULL; END;

    -- 2. Delete child tables before parent tables
    DELETE FROM ORDER_ITEMS;
    DELETE FROM ORDERS;
    DELETE FROM PRODUCTS;
    DELETE FROM CUSTOMERS;
    DELETE FROM TT_CHECKPOINT_DATA;
    DELETE FROM TT_POLICY_DECISIONS;
    DELETE FROM TT_CHECKPOINTS;
    DELETE FROM TT_QUERY_METRICS;
    DELETE FROM TT_CHANGE_LOG;
    DELETE FROM TT_TRANSACTIONS;
    COMMIT;

    -- 3. Re-enable triggers for realistic capture
    BEGIN EXECUTE IMMEDIATE 'ALTER TRIGGER TRG_CUSTOMERS_HISTORY ENABLE'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN EXECUTE IMMEDIATE 'ALTER TRIGGER TRG_PRODUCTS_HISTORY ENABLE'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN EXECUTE IMMEDIATE 'ALTER TRIGGER TRG_ORDERS_HISTORY ENABLE'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN EXECUTE IMMEDIATE 'ALTER TRIGGER TRG_ORDER_ITEMS_HISTORY ENABLE'; EXCEPTION WHEN OTHERS THEN NULL; END;
END;
/

PROMPT Seeding Phase 1: Initial Business Entities...

-- 1. Insert Customers
INSERT INTO CUSTOMERS (customer_id, name, email, phone, status, credit_limit, created_at, updated_at)
VALUES (101, 'Acme Industrial Corp', 'procurement@acmeind.com', '+1-555-0101', 'ACTIVE', 50000.00, SYSTIMESTAMP - INTERVAL '2' HOUR, SYSTIMESTAMP - INTERVAL '2' HOUR);

INSERT INTO CUSTOMERS (customer_id, name, email, phone, status, credit_limit, created_at, updated_at)
VALUES (102, 'Omni Consumer Products', 'orders@ocpcorp.com', '+1-555-0102', 'ACTIVE', 125000.00, SYSTIMESTAMP - INTERVAL '2' HOUR, SYSTIMESTAMP - INTERVAL '2' HOUR);

INSERT INTO CUSTOMERS (customer_id, name, email, phone, status, credit_limit, created_at, updated_at)
VALUES (103, 'Stark Tech Solutions', 'tony@starksolutions.io', '+1-555-0103', 'ACTIVE', 750000.00, SYSTIMESTAMP - INTERVAL '2' HOUR, SYSTIMESTAMP - INTERVAL '2' HOUR);

INSERT INTO CUSTOMERS (customer_id, name, email, phone, status, credit_limit, created_at, updated_at)
VALUES (104, 'Wayne Enterprises', 'bruce@waynecorp.com', '+1-555-0104', 'ACTIVE', 1000000.00, SYSTIMESTAMP - INTERVAL '2' HOUR, SYSTIMESTAMP - INTERVAL '2' HOUR);

INSERT INTO CUSTOMERS (customer_id, name, email, phone, status, credit_limit, created_at, updated_at)
VALUES (105, 'Cyberdyne Systems', 'miles@cyberdyne.net', '+1-555-0105', 'SUSPENDED', 15000.00, SYSTIMESTAMP - INTERVAL '2' HOUR, SYSTIMESTAMP - INTERVAL '2' HOUR);

-- 2. Insert Products
INSERT INTO PRODUCTS (product_id, sku, name, category, unit_price, stock_quantity, created_at, updated_at)
VALUES (201, 'SKU-SRV-01', 'High-Density Rack Server', 'Hardware', 4500.00, 45, SYSTIMESTAMP - INTERVAL '2' HOUR, SYSTIMESTAMP - INTERVAL '2' HOUR);

INSERT INTO PRODUCTS (product_id, sku, name, category, unit_price, stock_quantity, created_at, updated_at)
VALUES (202, 'SKU-SW-DB', 'Enterprise DBMS License 1-Yr', 'Software', 12000.00, 200, SYSTIMESTAMP - INTERVAL '2' HOUR, SYSTIMESTAMP - INTERVAL '2' HOUR);

INSERT INTO PRODUCTS (product_id, sku, name, category, unit_price, stock_quantity, created_at, updated_at)
VALUES (203, 'SKU-NET-40G', '40GbE Managed Fiber Switch', 'Networking', 2850.00, 30, SYSTIMESTAMP - INTERVAL '2' HOUR, SYSTIMESTAMP - INTERVAL '2' HOUR);

INSERT INTO PRODUCTS (product_id, sku, name, category, unit_price, stock_quantity, created_at, updated_at)
VALUES (204, 'SKU-SEC-APP', 'Next-Gen Firewall Appliance', 'Security', 6200.00, 18, SYSTIMESTAMP - INTERVAL '2' HOUR, SYSTIMESTAMP - INTERVAL '2' HOUR);

INSERT INTO PRODUCTS (product_id, sku, name, category, unit_price, stock_quantity, created_at, updated_at)
VALUES (205, 'SKU-PWR-UPS', 'Modular 10kVA Online UPS', 'Power', 3400.00, 25, SYSTIMESTAMP - INTERVAL '2' HOUR, SYSTIMESTAMP - INTERVAL '2' HOUR);

-- 3. Insert Orders & Line Items
INSERT INTO ORDERS (order_id, customer_id, order_date, status, total_amount, notes, updated_at)
VALUES (501, 101, SYSTIMESTAMP - INTERVAL '10' DAY, 'COMPLETED', 21000.00, 'Initial server deployment for factory A', SYSTIMESTAMP - INTERVAL '10' DAY);

INSERT INTO ORDER_ITEMS (item_id, order_id, product_id, quantity, unit_price, subtotal)
VALUES (1001, 501, 201, 2, 4500.00, 9000.00);

INSERT INTO ORDER_ITEMS (item_id, order_id, product_id, quantity, unit_price, subtotal)
VALUES (1002, 501, 202, 1, 12000.00, 12000.00);

INSERT INTO ORDERS (order_id, customer_id, order_date, status, total_amount, notes, updated_at)
VALUES (502, 103, SYSTIMESTAMP - INTERVAL '8' DAY, 'PROCESSING', 9050.00, 'R&D Lab networking upgrade', SYSTIMESTAMP - INTERVAL '8' DAY);

INSERT INTO ORDER_ITEMS (item_id, order_id, product_id, quantity, unit_price, subtotal)
VALUES (1003, 502, 203, 1, 2850.00, 2850.00);

INSERT INTO ORDER_ITEMS (item_id, order_id, product_id, quantity, unit_price, subtotal)
VALUES (1004, 502, 204, 1, 6200.00, 6200.00);

-- 4. Bulk Seed Additional Records to reach 50 rows per table
BEGIN
    FOR i IN 106..150 LOOP
        INSERT INTO CUSTOMERS (customer_id, name, email, phone, status, credit_limit, created_at, updated_at)
        VALUES (
            i,
            'Enterprise Partner ' || i,
            'ops' || i || '@partnercorp.com',
            '+1-555-' || TO_CHAR(i, 'FM0000'),
            CASE WHEN MOD(i, 5) = 0 THEN 'SUSPENDED' ELSE 'ACTIVE' END,
            (MOD(i, 10) + 1) * 25000.00,
            SYSTIMESTAMP - INTERVAL '2' HOUR,
            SYSTIMESTAMP - INTERVAL '2' HOUR
        );
    END LOOP;

    FOR i IN 206..250 LOOP
        INSERT INTO PRODUCTS (product_id, sku, name, category, unit_price, stock_quantity, created_at, updated_at)
        VALUES (
            i,
            'SKU-ENT-' || i,
            'Enterprise Hardware/SW Unit ' || (i - 200),
            CASE MOD(i, 5)
                WHEN 0 THEN 'Hardware'
                WHEN 1 THEN 'Software'
                WHEN 2 THEN 'Networking'
                WHEN 3 THEN 'Security'
                ELSE 'Power'
            END,
            500.00 + (i - 200) * 150.00,
            10 + MOD(i, 40) * 5,
            SYSTIMESTAMP - INTERVAL '2' HOUR,
            SYSTIMESTAMP - INTERVAL '2' HOUR
        );
    END LOOP;

    FOR i IN 504..550 LOOP
        INSERT INTO ORDERS (order_id, customer_id, order_date, status, total_amount, notes, updated_at)
        VALUES (
            i,
            101 + MOD(i - 504, 50),
            SYSTIMESTAMP - INTERVAL '110' MINUTE,
            CASE MOD(i, 4)
                WHEN 0 THEN 'COMPLETED'
                WHEN 1 THEN 'PROCESSING'
                WHEN 2 THEN 'PENDING'
                ELSE 'DELIVERED'
            END,
            1500.00 + (i - 500) * 350.00,
            'Enterprise procurement batch #' || i,
            SYSTIMESTAMP - INTERVAL '100' MINUTE
        );
    END LOOP;

    FOR i IN 1006..1050 LOOP
        INSERT INTO ORDER_ITEMS (item_id, order_id, product_id, quantity, unit_price, subtotal)
        VALUES (
            i,
            504 + MOD(i - 1006, 47),
            201 + MOD(i - 1006, 50),
            1 + MOD(i, 4),
            1000.00,
            (1 + MOD(i, 4)) * 1000.00
        );
    END LOOP;
END;
/

COMMIT;

PROMPT Phase 1 Complete. Initial Baseline Checkpoint...
DECLARE
    v_cp1 NUMBER;
BEGIN
    v_cp1 := TT_CHECKPOINT_PKG.create_checkpoint('CUSTOMERS', 'MANUAL', 'Baseline initial state checkpoint');
    v_cp1 := TT_CHECKPOINT_PKG.create_checkpoint('PRODUCTS', 'MANUAL', 'Baseline initial state checkpoint');
END;
/

PROMPT Seeding Phase 2: Simulating Workload Updates and Evolution...

-- Customer 101 increases credit limit and updates contact
UPDATE CUSTOMERS 
SET credit_limit = 75000.00, phone = '+1-555-0999', status = 'ACTIVE' 
WHERE customer_id = 101;
COMMIT;

-- Product 201 price reduction and stock consumption
UPDATE PRODUCTS 
SET unit_price = 4250.00, stock_quantity = 35 
WHERE product_id = 201;
COMMIT;

-- Customer 105 restored from suspension to active with credit expansion
UPDATE CUSTOMERS 
SET status = 'ACTIVE', credit_limit = 40000.00 
WHERE customer_id = 105;
COMMIT;

-- Customer 102 places order 503
INSERT INTO ORDERS (order_id, customer_id, order_date, status, total_amount, notes, updated_at)
VALUES (503, 102, SYSTIMESTAMP - INTERVAL '20' MINUTE, 'PENDING', 24000.00, 'Cloud datacenter expansion license batch', SYSTIMESTAMP - INTERVAL '20' MINUTE);

INSERT INTO ORDER_ITEMS (item_id, order_id, product_id, quantity, unit_price, subtotal)
VALUES (1005, 503, 202, 2, 12000.00, 24000.00);
COMMIT;

-- Order 503 status progresses
UPDATE ORDERS SET status = 'PROCESSING' WHERE order_id = 503;
COMMIT;

UPDATE ORDERS SET status = 'COMPLETED' WHERE order_id = 503;
COMMIT;

PROMPT Seeding Phase 3: Evaluating Adaptive Checkpoint Policy...
DECLARE
    v_act VARCHAR2(30);
BEGIN
    v_act := TT_CHECKPOINT_PKG.evaluate_adaptive_policy('CUSTOMERS');
    DBMS_OUTPUT.PUT_LINE('Adaptive Policy evaluation for CUSTOMERS: ' || v_act);
    v_act := TT_CHECKPOINT_PKG.evaluate_adaptive_policy('PRODUCTS');
    DBMS_OUTPUT.PUT_LINE('Adaptive Policy evaluation for PRODUCTS: ' || v_act);
END;
/

PROMPT Verification Summary:
SELECT table_name, count(*) as current_rows FROM (
    SELECT 'CUSTOMERS' as table_name FROM CUSTOMERS
    UNION ALL SELECT 'PRODUCTS' FROM PRODUCTS
    UNION ALL SELECT 'ORDERS' FROM ORDERS
    UNION ALL SELECT 'ORDER_ITEMS' FROM ORDER_ITEMS
) GROUP BY table_name;

SELECT COUNT(*) as historical_change_records FROM TT_CHANGE_LOG;
SELECT COUNT(*) as checkpoint_count FROM TT_CHECKPOINTS;
SELECT COUNT(*) as policy_decision_count FROM TT_POLICY_DECISIONS;
