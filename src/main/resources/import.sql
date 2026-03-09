-- FCA Anti-Money Laundering Rules for UK Market
-- Local Regulatory Database

-- GBP Rules
INSERT INTO aml_rules (id, currency, thresholdAmount, action, description) 
VALUES (1, 'GBP', 10000.00, 'REJECTED', 'Manual FCA review required for amounts over £10k');

INSERT INTO aml_rules (id, currency, thresholdAmount, action, description) 
VALUES (2, 'GBP', 5000.00, 'WARNING', 'Enhanced due diligence recommended for amounts over £5k');

INSERT INTO aml_rules (id, currency, thresholdAmount, action, description) 
VALUES (3, 'GBP', 0.00, 'CLEARED', 'Transaction within standard sovereign limits');

-- EUR Rules
INSERT INTO aml_rules (id, currency, thresholdAmount, action, description) 
VALUES (4, 'EUR', 15000.00, 'REJECTED', 'Manual FCA review required for EUR amounts over €15k');

INSERT INTO aml_rules (id, currency, thresholdAmount, action, description) 
VALUES (5, 'EUR', 0.00, 'CLEARED', 'EUR transaction within standard limits');

-- USD Rules
INSERT INTO aml_rules (id, currency, thresholdAmount, action, description) 
VALUES (6, 'USD', 15000.00, 'REJECTED', 'Manual FCA review required for USD amounts over $15k');

INSERT INTO aml_rules (id, currency, thresholdAmount, action, description) 
VALUES (7, 'USD', 0.00, 'CLEARED', 'USD transaction within standard limits');

-- Set sequence for auto-increment
ALTER SEQUENCE aml_rules_seq RESTART WITH 8;
