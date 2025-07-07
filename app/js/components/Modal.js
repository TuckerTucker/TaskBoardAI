/**
 * Modal Component
 * Handles modal functionality including opening, closing, and tab switching
 */

export class Modal {
    /**
     * Create a new Modal instance
     * @param {string} id - Modal element ID
     */
    constructor(id) {
        this.modalElement = document.getElementById(id);
        this.backdropElement = document.getElementById('modal-backdrop');
        
        if (!this.modalElement) {
            console.error(`Modal with ID "${id}" not found`);
            return;
        }
        
        this.closeButtons = this.modalElement.querySelectorAll('.close-modal-btn');
        this.tabButtons = this.modalElement.querySelectorAll('.tab-btn');
        this.tabContents = this.modalElement.querySelectorAll('.tab-content');
        
        // Ensure modal is hidden on initialization
        this.modalElement.classList.add('hidden');
        if (this.backdropElement) {
            this.backdropElement.classList.add('hidden');
        }
        
        this.initialize();
    }
    
    /**
     * Initialize modal event listeners
     */
    initialize() {
        // Close button click
        for (const button of this.closeButtons) {
            button.addEventListener('click', () => this.close());
        }
        
        // Backdrop click to close - only add if backdrop exists
        if (this.backdropElement) {
            this.backdropElement.addEventListener('click', () => this.close());
        }
        
        // Prevent clicks inside modal from closing it
        this.modalElement.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        // Tab switching
        for (const button of this.tabButtons) {
            button.addEventListener('click', () => {
                const tabName = button.dataset.tab;
                this.switchTab(tabName);
            });
        }
        
        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.modalElement.classList.contains('hidden')) {
                this.close();
            }
        });
    }
    
    /**
     * Open the modal
     */
    open() {
        // Ensure backdrop element exists
        if (!this.backdropElement) {
            this.backdropElement = document.getElementById('modal-backdrop');
            if (!this.backdropElement) {
                // Create backdrop if it doesn't exist
                this.backdropElement = document.createElement('div');
                this.backdropElement.id = 'modal-backdrop';
                this.backdropElement.className = 'modal-backdrop';
                this.backdropElement.style.position = 'fixed';
                this.backdropElement.style.top = '0';
                this.backdropElement.style.left = '0';
                this.backdropElement.style.width = '100%';
                this.backdropElement.style.height = '100%';
                this.backdropElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
                this.backdropElement.style.zIndex = '999';
                document.body.appendChild(this.backdropElement);
                
                // Add click event listener to close modal when backdrop is clicked
                this.backdropElement.addEventListener('click', () => this.close());
            }
        }
        
        // Show backdrop and modal
        this.backdropElement.classList.remove('hidden');
        this.modalElement.classList.remove('hidden');
        document.body.style.overflow = 'hidden'; // Prevent scrolling behind modal
    }
    
    /**
     * Close the modal
     */
    close() {
        // Only hide backdrop if it exists
        if (this.backdropElement) {
            this.backdropElement.classList.add('hidden');
        }
        this.modalElement.classList.add('hidden');
        document.body.style.overflow = ''; // Restore scrolling
    }
    
    /**
     * Switch to a specific tab
     * @param {string} tabName - Name of the tab to switch to
     */
    switchTab(tabName) {
        // Update tab buttons
        for (const button of this.tabButtons) {
            if (button.dataset.tab === tabName) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        }
        
        // Update tab content
        for (const content of this.tabContents) {
            if (content.id === `${tabName}-tab`) {
                content.classList.add('active');
            } else {
                content.classList.remove('active');
            }
        }
    }
}
