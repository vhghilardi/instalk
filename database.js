const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const path = require('path');

class Database {
    constructor() {
        this.db = new sqlite3.Database(path.join(__dirname, 'instagram_manager.db'));
        this.init();
    }

    init() {
        console.log('🗄️ Inicializando banco de dados...');
        
        // Criar tabelas se não existirem
        this.db.serialize(() => {
            console.log('📋 Criando tabelas...');
            
            // Tabela de instâncias do Instagram
            this.db.run(`
                CREATE TABLE IF NOT EXISTS instances (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    username TEXT NOT NULL,
                    password TEXT,
                    status TEXT DEFAULT 'disconnected',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    last_activity DATETIME,
                    session_data TEXT,
                    metadata TEXT,
                    is_active BOOLEAN DEFAULT 1
                )
            `, (err) => {
                if (err) console.error('Erro ao criar tabela instances:', err);
                else console.log('✅ Tabela instances criada');
            });

            // Adicionar coluna password se não existir (para bancos existentes)
            this.db.run(`
                ALTER TABLE instances ADD COLUMN password TEXT
            `, (err) => {
                if (err && !err.message.includes('duplicate column name')) {
                    console.error('Erro ao adicionar coluna password:', err);
                } else if (!err) {
                    console.log('✅ Coluna password adicionada');
                }
            });

            // Tabela de logs
            this.db.run(`
                CREATE TABLE IF NOT EXISTS logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    instance_id TEXT,
                    level TEXT NOT NULL,
                    message TEXT NOT NULL,
                    data TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (instance_id) REFERENCES instances (id)
                )
            `, (err) => {
                if (err) console.error('Erro ao criar tabela logs:', err);
                else console.log('✅ Tabela logs criada');
            });

            // Tabela de configurações
            this.db.run(`
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) console.error('Erro ao criar tabela settings:', err);
                else console.log('✅ Tabela settings criada');
            });
        });
    }

    // Verificar token fixo do .env
    verifyToken(token) {
        const validToken = process.env.API_TOKEN || 'instagram-manager-token';
        
        if (token === validToken) {
            return { success: true, message: 'Token válido' };
        } else {
            return { success: false, message: 'Token inválido' };
        }
    }

    // Métodos de instâncias
    async createInstance(name, username, password = null) {
        const instanceId = randomUUID();
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO instances (id, name, username, password) VALUES (?, ?, ?, ?)',
                [instanceId, name, username, password],
                function(err) {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve({ success: true, instanceId: instanceId });
                }
            );
        });
    }

    async getInstances() {
        return new Promise((resolve, reject) => {
            console.log('🔍 Buscando instâncias no banco de dados...');
            this.db.all(
                'SELECT * FROM instances WHERE is_active = 1 ORDER BY created_at DESC',
                (err, rows) => {
                    if (err) {
                        console.error('❌ Erro ao buscar instâncias:', err);
                        reject(err);
                        return;
                    }
                    console.log(`✅ Encontradas ${rows.length} instâncias no banco`);
                    resolve(rows);
                }
            );
        });
    }

    async getInstance(instanceId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM instances WHERE id = ? AND is_active = 1',
                [instanceId],
                (err, row) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(row);
                }
            );
        });
    }

    async updateInstanceStatus(instanceId, status, sessionData = null, metadata = null) {
        return new Promise((resolve, reject) => {
            const updates = ['status = ?', 'last_activity = CURRENT_TIMESTAMP'];
            const params = [status];

            if (sessionData) {
                updates.push('session_data = ?');
                params.push(JSON.stringify(sessionData));
            }

            if (metadata) {
                updates.push('metadata = ?');
                params.push(JSON.stringify(metadata));
            }

            params.push(instanceId);

            this.db.run(
                `UPDATE instances SET ${updates.join(', ')} WHERE id = ?`,
                params,
                function(err) {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve({ success: true });
                }
            );
        });
    }

    async updateInstancePassword(instanceId, password) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE instances SET password = ? WHERE id = ?',
                [password, instanceId],
                function(err) {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve({ success: true });
                }
            );
        });
    }

    async deleteInstance(instanceId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE instances SET is_active = 0 WHERE id = ?',
                [instanceId],
                function(err) {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve({ success: true });
                }
            );
        });
    }

    // Métodos de logs
    async addLog(instanceId, level, message, data = null) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO logs (instance_id, level, message, data) VALUES (?, ?, ?, ?)',
                [instanceId, level, message, data ? JSON.stringify(data) : null],
                function(err) {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve({ success: true });
                }
            );
        });
    }

    async getLogs(instanceId = null, limit = 100) {
        return new Promise((resolve, reject) => {
            let query = 'SELECT * FROM logs';
            let params = [];

            if (instanceId) {
                query += ' WHERE instance_id = ?';
                params.push(instanceId);
            }

            query += ' ORDER BY created_at DESC LIMIT ?';
            params.push(limit);

            this.db.all(query, params, (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(rows);
            });
        });
    }

    // Métodos de configurações
    async setSetting(key, value) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
                [key, value],
                function(err) {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve({ success: true });
                }
            );
        });
    }

    async getSetting(key) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT value FROM settings WHERE key = ?',
                [key],
                (err, row) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(row ? row.value : null);
                }
            );
        });
    }

    close() {
        this.db.close();
    }
}

module.exports = Database;
