-- ============================================================================
-- SCRIPT 01: Create Current Business Schema Tables
-- Project: Time Travel Database System
-- Target: Oracle Database 21c XE
-- Description: Creates current business entity tables (CUSTOMERS, PRODUCTS, ORDERS, ORDER_ITEMS)
-- ============================================================================

-- Safe cleanup for reinstall
BEGIN
    EXECUTE IMMEDIATE 'DROP TABLE ORDER_ITEMS CASCADE CONSTRAINTS';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

BEGIN
    EXECUTE IMMEDIATE 'DROP TABLE ORDERS CASCADE CONSTRAINTS';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

BEGIN
    EXECUTE IMMEDIATE 'DROP TABLE PRODUCTS CASCADE CONSTRAINTS';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

BEGIN
    EXECUTE IMMEDIATE 'DROP TABLE CUSTOMERS CASCADE CONSTRAINTS';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

-- 1. CUSTOMERS Table
CREATE TABLE CUSTOMERS (
    customer_id     NUMBER PRIMARY KEY,
    name            VARCHAR2(100) NOT NULL,
    email           VARCHAR2(150) NOT NULL UNIQUE,
    phone           VARCHAR2(30),
    status          VARCHAR2(20) DEFAULT 'ACTIVE' NOT NULL 
                    CHECK (status IN ('ACTIVE', 'SUSPENDED', 'INACTIVE')),
    credit_limit    NUMBER(12,2) DEFAULT 1000.00 NOT NULL CHECK (credit_limit >= 0),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL
);

-- 2. PRODUCTS Table
CREATE TABLE PRODUCTS (
    product_id      NUMBER PRIMARY KEY,
    sku             VARCHAR2(50) NOT NULL UNIQUE,
    name            VARCHAR2(150) NOT NULL,
    category        VARCHAR2(50) NOT NULL,
    unit_price      NUMBER(10,2) NOT NULL CHECK (unit_price >= 0),
    stock_quantity  NUMBER(8) DEFAULT 0 NOT NULL CHECK (stock_quantity >= 0),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL
);

-- 3. ORDERS Table
CREATE TABLE ORDERS (
    order_id        NUMBER PRIMARY KEY,
    customer_id     NUMBER NOT NULL REFERENCES CUSTOMERS(customer_id),
    order_date      TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    status          VARCHAR2(30) DEFAULT 'PENDING' NOT NULL 
                    CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'REFUNDED')),
    total_amount    NUMBER(12,2) DEFAULT 0.00 NOT NULL CHECK (total_amount >= 0),
    notes           VARCHAR2(400),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL
);

-- 4. ORDER_ITEMS Table
CREATE TABLE ORDER_ITEMS (
    item_id         NUMBER PRIMARY KEY,
    order_id        NUMBER NOT NULL REFERENCES ORDERS(order_id) ON DELETE CASCADE,
    product_id      NUMBER NOT NULL REFERENCES PRODUCTS(product_id),
    quantity        NUMBER(6) NOT NULL CHECK (quantity > 0),
    unit_price      NUMBER(10,2) NOT NULL CHECK (unit_price >= 0),
    subtotal        NUMBER(12,2) NOT NULL CHECK (subtotal >= 0)
);

-- Helpful indexes for operational queries
CREATE INDEX IDX_CUST_STATUS ON CUSTOMERS(status);
CREATE INDEX IDX_PROD_CAT ON PRODUCTS(category);
CREATE INDEX IDX_ORDERS_CUST ON ORDERS(customer_id);
CREATE INDEX IDX_ORDERS_STATUS ON ORDERS(status);
CREATE INDEX IDX_ORDER_ITEMS_ORDER ON ORDER_ITEMS(order_id);
CREATE INDEX IDX_ORDER_ITEMS_PROD ON ORDER_ITEMS(product_id);

COMMENT ON TABLE CUSTOMERS IS 'Core customer entity current state';
COMMENT ON TABLE PRODUCTS IS 'Core inventory/product catalog current state';
COMMENT ON TABLE ORDERS IS 'Customer purchase orders current state';
COMMENT ON TABLE ORDER_ITEMS IS 'Line items belonging to customer orders';
