-- Create users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create entities table
CREATE TABLE entities (
    uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    address_1 VARCHAR(255),
    address_2 VARCHAR(255),
    path VARCHAR(255) NOT NULL,
    depth INTEGER DEFAULT 0,
    admin INTEGER DEFAULT 1,
    city VARCHAR(100),
    state VARCHAR(100),
    zip_code VARCHAR(20),
    country VARCHAR(100),
    email VARCHAR(255),
    website VARCHAR(255),
    phone VARCHAR(50),
    hidden BOOLEAN DEFAULT FALSE,
    accrual_method BOOLEAN DEFAULT TRUE,
    fy_start_month INTEGER CHECK (fy_start_month >= 1 AND fy_start_month <= 12),
    last_closing_date DATE,
    meta JSONB DEFAULT '{}',
    managers JSONB DEFAULT '[]',
    user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create ledgers table
CREATE TABLE ledgers (
    uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ledger_name VARCHAR(255) NOT NULL,
    entity_uuid UUID REFERENCES entities(uuid) ON DELETE CASCADE,
    posted BOOLEAN DEFAULT FALSE,
    locked BOOLEAN DEFAULT FALSE,
    hidden BOOLEAN DEFAULT FALSE,
    additional_info JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create accounts table
CREATE TABLE accounts (
    uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_name VARCHAR(255) NOT NULL,
    account_code VARCHAR(50) NOT NULL,
    account_type VARCHAR(50) CHECK (account_type IN ('Asset', 'Liability', 'Equity', 'Revenue', 'Expense', 'COGS')),
    ledger_uuid UUID REFERENCES ledgers(uuid) ON DELETE CASCADE,
    initial_balance DECIMAL(15,2) DEFAULT 0.00,
    current_balance DECIMAL(15,2) DEFAULT 0.00,
    description TEXT,
    parent_account_uuid UUID REFERENCES accounts(uuid),
    status VARCHAR(50) DEFAULT 'Active',
    meta JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create transactions table
CREATE TABLE transactions (
    uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_uuid UUID REFERENCES accounts(uuid) ON DELETE CASCADE,
    amount DECIMAL(15,2) NOT NULL,
    description TEXT,
    tx_type VARCHAR(2) CHECK (tx_type IN ('dr', 'cr')),
    entity_unit_uuid UUID,
    corresponding_account_uuid UUID REFERENCES accounts(uuid),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_entities_user_id ON entities(user_id);
CREATE INDEX idx_ledgers_entity_uuid ON ledgers(entity_uuid);
CREATE INDEX idx_accounts_ledger_uuid ON accounts(ledger_uuid);
CREATE INDEX idx_accounts_account_type ON accounts(account_type);
CREATE INDEX idx_transactions_account_uuid ON transactions(account_uuid);
CREATE INDEX idx_transactions_timestamp ON transactions(timestamp);