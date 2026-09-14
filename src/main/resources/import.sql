-- Illustrative demo policies, not FCA regulatory thresholds
-- Local Regulatory Database

-- GBP Rules
INSERT INTO aml_rules (id, currency, thresholdAmount, action, description) 
VALUES (1, 'GBP', 10000.00, 'REJECTED', 'Demo policy: manual review required for amounts of £10,000 or more.');

INSERT INTO aml_rules (id, currency, thresholdAmount, action, description) 
VALUES (2, 'GBP', 5000.00, 'WARNING', 'Demo policy: enhanced due diligence for amounts of £5,000 or more.');

INSERT INTO aml_rules (id, currency, thresholdAmount, action, description) 
VALUES (3, 'GBP', 0.00, 'CLEARED', 'Transaction is below the demo GBP review thresholds.');

-- EUR Rules
INSERT INTO aml_rules (id, currency, thresholdAmount, action, description) 
VALUES (4, 'EUR', 15000.00, 'REJECTED', 'Demo policy: manual review required for amounts of €15,000 or more.');

INSERT INTO aml_rules (id, currency, thresholdAmount, action, description) 
VALUES (5, 'EUR', 0.00, 'CLEARED', 'Transaction is below the demo EUR review threshold.');

-- USD Rules
INSERT INTO aml_rules (id, currency, thresholdAmount, action, description) 
VALUES (6, 'USD', 15000.00, 'REJECTED', 'Demo policy: manual review required for amounts of $15,000 or more.');

INSERT INTO aml_rules (id, currency, thresholdAmount, action, description) 
VALUES (7, 'USD', 0.00, 'CLEARED', 'Transaction is below the demo USD review threshold.');

-- Set sequence for auto-increment
ALTER SEQUENCE aml_rules_seq RESTART WITH 8;
