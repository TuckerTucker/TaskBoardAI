/**
 * NextSteps Component
 * Manages the next steps sidebar in the kanban board
 */
export class NextSteps {
    constructor() {
        this.element = document.querySelector('.next-steps-sidebar');
        this.list = this.element.querySelector('.next-steps-list');
        
        if (!this.element) {
            console.error('Next steps sidebar element not found');
            return;
        }
        if (!this.list) {
            console.error('Next steps list element not found');
            return;
        }
        
        console.log('NextSteps component initialized');
    }

    /**
     * Update the next steps list
     * @param {string[]} steps - Array of next step items
     */
    update(steps) {
        console.log('Updating next steps with:', steps);
        if (!this.list) {
            console.error('Cannot update next steps: list element not found');
            return;
        }
        this.list.innerHTML = steps
            .map(step => `<li>${step}</li>`)
            .join('');
        console.log('Next steps updated');
    }
}
