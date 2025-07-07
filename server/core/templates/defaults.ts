import { CreateBoardTemplate, CreateColumnTemplate, CreateCardTemplate } from '../schemas/templateSchemas.js';

export const defaultBoardTemplates: CreateBoardTemplate[] = [
  {
    name: 'Basic Project',
    description: 'A simple three-column project board for getting started',
    category: 'General',
    isDefault: true,
    title: 'New Project',
    boardDescription: 'A basic project tracking board',
    columns: [
      { title: 'To Do', description: 'Tasks to be started', wip: null, position: 0 },
      { title: 'In Progress', description: 'Tasks currently being worked on', wip: 3, position: 1 },
      { title: 'Done', description: 'Completed tasks', wip: null, position: 2 }
    ]
  },
  {
    name: 'Agile Sprint',
    description: 'Standard agile sprint board with backlog and review columns',
    category: 'Agile',
    isDefault: false,
    title: 'Sprint Board',
    boardDescription: 'Agile sprint planning and tracking board',
    columns: [
      { title: 'Backlog', description: 'Sprint backlog items', wip: null, position: 0 },
      { title: 'To Do', description: 'Ready to start', wip: null, position: 1 },
      { title: 'In Progress', description: 'Currently in development', wip: 5, position: 2 },
      { title: 'Review', description: 'Ready for review/testing', wip: 3, position: 3 },
      { title: 'Done', description: 'Completed this sprint', wip: null, position: 4 }
    ]
  },
  {
    name: 'Bug Tracking',
    description: 'Specialized board for tracking and resolving bugs',
    category: 'Development',
    isDefault: false,
    title: 'Bug Tracker',
    boardDescription: 'Track and resolve software bugs',
    columns: [
      { title: 'Reported', description: 'Newly reported bugs', wip: null, position: 0 },
      { title: 'Triaged', description: 'Bugs assigned priority and owner', wip: null, position: 1 },
      { title: 'In Progress', description: 'Bugs being fixed', wip: 3, position: 2 },
      { title: 'Testing', description: 'Fixes being tested', wip: 2, position: 3 },
      { title: 'Resolved', description: 'Fixed and verified bugs', wip: null, position: 4 }
    ]
  },
  {
    name: 'Content Creation',
    description: 'Board for managing content creation workflow',
    category: 'Content',
    isDefault: false,
    title: 'Content Pipeline',
    boardDescription: 'Manage content from ideation to publication',
    columns: [
      { title: 'Ideas', description: 'Content ideas and topics', wip: null, position: 0 },
      { title: 'Research', description: 'Researching content topics', wip: 2, position: 1 },
      { title: 'Writing', description: 'Creating content', wip: 3, position: 2 },
      { title: 'Review', description: 'Content review and editing', wip: 2, position: 3 },
      { title: 'Published', description: 'Published content', wip: null, position: 4 }
    ]
  },
  {
    name: 'Personal Tasks',
    description: 'Simple personal task management board',
    category: 'Personal',
    isDefault: false,
    title: 'My Tasks',
    boardDescription: 'Personal task and goal tracking',
    columns: [
      { title: 'Someday', description: 'Future tasks and ideas', wip: null, position: 0 },
      { title: 'This Week', description: 'Tasks for this week', wip: 5, position: 1 },
      { title: 'Today', description: 'Today\'s priorities', wip: 3, position: 2 },
      { title: 'Completed', description: 'Finished tasks', wip: null, position: 3 }
    ]
  }
];

export const defaultColumnTemplates: CreateColumnTemplate[] = [
  {
    name: 'To Do',
    description: 'Standard to-do column for new tasks',
    category: 'Basic',
    isDefault: true,
    title: 'To Do',
    columnDescription: 'Tasks ready to be started',
    wip: null
  },
  {
    name: 'In Progress',
    description: 'Standard in-progress column with WIP limit',
    category: 'Basic',
    isDefault: false,
    title: 'In Progress',
    columnDescription: 'Tasks currently being worked on',
    wip: 3
  },
  {
    name: 'Done',
    description: 'Standard done column for completed tasks',
    category: 'Basic',
    isDefault: false,
    title: 'Done',
    columnDescription: 'Completed tasks',
    wip: null
  },
  {
    name: 'Backlog',
    description: 'Backlog column for prioritized items',
    category: 'Agile',
    isDefault: false,
    title: 'Backlog',
    columnDescription: 'Prioritized items waiting to be started',
    wip: null
  },
  {
    name: 'Review',
    description: 'Review column with limited WIP',
    category: 'Quality',
    isDefault: false,
    title: 'Review',
    columnDescription: 'Items ready for review or testing',
    wip: 2
  },
  {
    name: 'Blocked',
    description: 'Column for blocked or waiting items',
    category: 'Status',
    isDefault: false,
    title: 'Blocked',
    columnDescription: 'Items blocked by external dependencies',
    wip: null
  }
];

export const defaultCardTemplates: CreateCardTemplate[] = [
  {
    name: 'Basic Task',
    description: 'Simple task card template',
    category: 'General',
    isDefault: true,
    title: 'New Task',
    priority: 'medium',
    cardDescription: 'Task description',
    tags: []
  },
  {
    name: 'User Story',
    description: 'Agile user story template',
    category: 'Agile',
    isDefault: false,
    title: 'As a [user], I want [goal] so that [benefit]',
    priority: 'medium',
    cardDescription: 'Acceptance criteria:\n- [ ] Criterion 1\n- [ ] Criterion 2\n- [ ] Criterion 3',
    tags: ['user-story']
  },
  {
    name: 'Bug Report',
    description: 'Bug report card template',
    category: 'Development',
    isDefault: false,
    title: 'Bug: [Brief Description]',
    priority: 'high',
    cardDescription: '**Steps to Reproduce:**\n1. \n2. \n3. \n\n**Expected Result:**\n\n**Actual Result:**\n\n**Environment:**\n- Browser: \n- OS: \n- Version: ',
    tags: ['bug']
  },
  {
    name: 'Feature Request',
    description: 'Feature request template',
    category: 'Development',
    isDefault: false,
    title: 'Feature: [Feature Name]',
    priority: 'medium',
    cardDescription: '**Problem:**\n\n**Proposed Solution:**\n\n**Alternative Solutions:**\n\n**Acceptance Criteria:**\n- [ ] \n- [ ] \n- [ ] ',
    tags: ['feature', 'enhancement']
  },
  {
    name: 'Research Task',
    description: 'Research and investigation task',
    category: 'Research',
    isDefault: false,
    title: 'Research: [Topic]',
    priority: 'low',
    cardDescription: '**Research Question:**\n\n**Key Areas to Investigate:**\n- \n- \n- \n\n**Deliverables:**\n- [ ] Research summary\n- [ ] Recommendations\n- [ ] Next steps',
    tags: ['research']
  },
  {
    name: 'Meeting Note',
    description: 'Meeting follow-up task template',
    category: 'Communication',
    isDefault: false,
    title: 'Follow-up: [Meeting Name]',
    priority: 'medium',
    cardDescription: '**Meeting Date:**\n\n**Attendees:**\n\n**Action Items:**\n- [ ] \n- [ ] \n- [ ] \n\n**Decisions Made:**\n\n**Next Meeting:**',
    tags: ['meeting', 'follow-up']
  },
  {
    name: 'Content Idea',
    description: 'Content creation idea template',
    category: 'Content',
    isDefault: false,
    title: 'Content: [Title/Topic]',
    priority: 'low',
    cardDescription: '**Target Audience:**\n\n**Key Messages:**\n- \n- \n- \n\n**Content Type:**\n\n**Distribution Channels:**\n\n**Success Metrics:**',
    tags: ['content', 'idea']
  },
  {
    name: 'Personal Goal',
    description: 'Personal goal tracking template',
    category: 'Personal',
    isDefault: false,
    title: 'Goal: [Goal Name]',
    priority: 'medium',
    cardDescription: '**Objective:**\n\n**Why This Matters:**\n\n**Success Criteria:**\n- [ ] \n- [ ] \n- [ ] \n\n**Deadline:**\n\n**Next Steps:**\n- [ ] \n- [ ] ',
    tags: ['goal', 'personal']
  }
];