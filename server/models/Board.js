const fs = require('fs').promises;
const path = require('path');
const config = require('../config/config');

class Board {
    constructor(data = null) {
        this.data = data || {
            projectName: 'My Kanban Board',
            columns: []
        };
    }

    // Load board data from file
    static async load() {
        try {
            const data = await fs.readFile(config.dataFile, 'utf8');
            return new Board(JSON.parse(data));
        } catch (error) {
            if (error.code === 'ENOENT') {
                // Return default board if file doesn't exist
                const board = new Board();
                await board.save();
                return board;
            }
            throw error;
        }
    }

    // Save board data to file
    async save() {
        // Update last_updated timestamp
        this.data.last_updated = new Date().toISOString();

        // Handle completion timestamps
        this.data.columns.forEach(column => {
            if (column.name.toLowerCase() === 'done') {
                column.items.forEach(item => {
                    if (!item.completed_at) {
                        item.completed_at = new Date().toISOString();
                    }
                });
            } else {
                // Remove completion timestamp if moved out of Done
                column.items.forEach(item => {
                    delete item.completed_at;
                });
            }
        });

        await fs.writeFile(config.dataFile, JSON.stringify(this.data, null, 2));
    }

    // Validate board data structure
    validate() {
        return (
            this.data &&
            typeof this.data === 'object' &&
            typeof this.data.projectName === 'string' &&
            Array.isArray(this.data.columns) &&
            this.data.columns.every(this.validateColumn) &&
            (this.data.description === undefined || typeof this.data.description === 'string') &&
            (this.data.last_updated === undefined || !isNaN(new Date(this.data.last_updated).getTime()))
        );
    }

    // Validate column structure
    validateColumn(column) {
        return (
            column &&
            typeof column === 'object' &&
            typeof column.id === 'string' &&
            typeof column.name === 'string' &&
            Array.isArray(column.items) &&
            column.items.every(Board.validateItem)
        );
    }

    // Validate item structure
    static validateItem(item) {
        if (!item || typeof item !== 'object') return false;
        if (!item.id || typeof item.id !== 'string') return false;
        if (!item.title || typeof item.title !== 'string') return false;
        if (typeof item.collapsed !== 'boolean' && item.collapsed !== undefined) return false;

        // Content/description validation
        if (item.content && typeof item.content !== 'string') return false;
        if (item.description && typeof item.description !== 'string') return false;

        // V2.1 fields validation
        if (item.subtasks !== undefined) {
            if (!Array.isArray(item.subtasks)) return false;
            if (!item.subtasks.every(task => typeof task === 'string')) return false;
        }

        if (item.tags !== undefined) {
            if (!Array.isArray(item.tags)) return false;
            if (!item.tags.every(tag => typeof tag === 'string')) return false;
        }

        if (item.dependencies !== undefined) {
            if (!Array.isArray(item.dependencies)) return false;
            if (!item.dependencies.every(dep => typeof dep === 'string')) return false;
        }

        if (item.completed_at !== undefined) {
            const timestamp = new Date(item.completed_at);
            if (isNaN(timestamp.getTime())) return false;
        }

        return true;
    }
}

module.exports = Board;
