# YAML Design Documentation Specification Guide

This guide provides detailed instructions for completing each section of your YAML design documentation, with examples and best practices.

## Core Project YAML

### Project Metadata

The project metadata section provides basic information about your project.

```yaml
project:
  name: "Project Name"
  version: "1.0.0"
  description: "Brief description of the project"
  author: "Team Name"
  role: "Role description"
  timestamp: "2025-06-15"
  status: "in-progress"
```

**Best Practices:**
- Use semantic versioning (MAJOR.MINOR.PATCH)
- Keep the description concise but informative
- Update the timestamp when making significant changes

### Technology Stack

Document the technologies used in your project.

```yaml
tech_stack:
  frontend:
    framework: "React"
    language: "TypeScript"
    build_tool: "Vite"
    package_manager: "npm"
    key_libraries:
      - name: "React Query"
        version: "^4.0.0"
        purpose: "Data fetching and caching"
  
  backend:
    framework: "Express"
    language: "Node.js"
    database: "PostgreSQL"
```

**Best Practices:**
- Include version constraints for key dependencies
- Document the purpose of important libraries
- List only significant technologies, not every package

### Global Design Tokens

Define reusable design values that will be referenced across components.

```yaml
global:
  design_tokens:
    colors:
      primary: "#0066cc"
      secondary: "#ff9900"
      accent: "#00cc99"
      text:
        primary: "#333333"
        secondary: "#666666"
      background:
        light: "#ffffff"
        dark: "#222222"
    
    typography:
      font_family: "Inter, system-ui, sans-serif"
      base_size: "16px"
      scale_ratio: 1.25
      weights:
        regular: 400
        medium: 500
        bold: 700
    
    spacing:
      base: "8px"
      scale:
        xs: "4px"    # 0.5x base
        sm: "8px"    # 1x base
        md: "16px"   # 2x base
        lg: "24px"   # 3x base
        xl: "32px"   # 4x base
```

**Best Practices:**
- Use a systematic approach to colors, spacing, and typography
- Document the relationships between values (e.g., scale multipliers)
- Use descriptive names that convey purpose, not just appearance

### Accessibility Standards

Define your project's accessibility requirements.

```yaml
accessibility:
  compliance: "WCAG 2.1 AA"
  color_contrast:
    minimum_ratio: "4.5:1"
  keyboard_navigation: true
  screen_reader_support: true
  focus_indicators:
    style: "outline"
    color: "#6200EE"
    width: "2px"
```

**Best Practices:**
- Specify a compliance target (e.g., WCAG 2.1 AA)
- Include specific requirements for common accessibility concerns
- Document project-specific accessibility patterns

### Responsive Design

Define your breakpoints and responsive strategy.

```yaml
responsive:
  breakpoints:
    mobile: "max-width: 599px"
    tablet: "600px to 1023px"
    desktop: "min-width: 1024px"
  strategy: "mobile-first"
  container_widths:
    max_width: "1280px"
    padding: "16px"
```

**Best Practices:**
- Use descriptive names for breakpoints rather than device names
- Document your responsive philosophy (mobile-first vs. desktop-first)
- Define standard container behavior

## Component YAML

### Component Metadata

Provide basic information about the component.

```yaml
component:
  name: "data_card"
  metadata:
    display_name: "Data Card"
    description: "A card displaying a data point with label and value"
    category: "data-display"
    status: "ready"
    created: "2025-05-10"
    last_updated: "2025-06-15"
    owner: "UI Components Team"
    project_reference: "../core-project.yaml"
```

**Best Practices:**
- Use snake_case for component names
- Provide a clear, specific description of the component's purpose
- Keep status updated as the component evolves

### Visual Properties

Define the component's visual characteristics.

```yaml
type: "article"
properties:
  attributes:
    role: "region"
    aria_label: "Data card: {label}"
  styling:
    background_color: "var(--color-background-light)"
    color: "var(--color-text-primary)"
    padding: "var(--spacing-md)"
    border:
      width: "1px"
      style: "solid"
      color: "var(--color-border)"
      radius: "var(--border-radius-md)"
  dimensions:
    min_width: "200px"
    max_width: "400px"
```

**Best Practices:**
- Reference design tokens from the core project using variables
- Include semantic HTML element type
- Specify appropriate ARIA attributes

### State Management

Document the component's possible states and transitions.

```yaml
state:
  initial_state:
    loading: true
    expanded: false
  states:
    - name: "loading"
      description: "When data is being fetched"
      visual: "Shows skeleton loader"
    - name: "error"
      description: "When data fetch fails"
      visual: "Shows error message with retry button"
    - name: "success"
      description: "When data is loaded successfully"
      visual: "Shows formatted data"
  state_transitions:
    - from: "loading"
      to: ["success", "error"]
      trigger: "API response"
    - from: "error"
      to: ["loading"]
      trigger: "Retry button click"
```

**Best Practices:**
- Include all possible component states
- Document valid state transitions
- Describe what triggers state changes
- Explain the visual appearance of each state

### Responsive Behavior

Define how the component adapts to different screen sizes.

```yaml
responsive:
  behavior:
    mobile:
      width: "100%"
      font_size: "90%"
    tablet:
      width: "calc(50% - var(--spacing-md))"
    desktop:
      width: "calc(33.33% - var(--spacing-md))"
  breakpoint_adjustments:
    - breakpoint: "mobile"
      changes:
        - property: "padding"
          value: "var(--spacing-sm)"
        - property: "margin"
          value: "var(--spacing-xs) 0"
```

**Best Practices:**
- Define behavior for all major breakpoints
- Use design tokens for responsive values
- Document specific property changes at each breakpoint

### Accessibility Specifications

Detail how the component supports accessibility.

```yaml
accessibility:
  role: "region"
  aria_attributes:
    - name: "aria-label"
      value: "Data card: {label}"
    - name: "aria-expanded"
      value: "{state.expanded}"
    - name: "aria-busy"
      value: "{state.loading}"
  keyboard_interactions:
    - key: "Enter"
      action: "Toggles expanded state"
    - key: "Space"
      action: "Toggles expanded state"
  screen_reader:
    announcements:
      load_complete: "Data loaded: {label} is {value}."
      error: "Error loading {label} data."
```

**Best Practices:**
- Include appropriate ARIA roles and attributes
- Document keyboard interactions
- Specify screen reader announcements
- Reference component state in dynamic attributes

### Data Requirements

Define the data needed by the component.

```yaml
data:
  required_fields:
    - name: "id"
      type: "string"
      description: "Unique identifier"
    - name: "label"
      type: "string"
      description: "Data point label"
    - name: "value"
      type: "number"
      description: "Current value"
  optional_fields:
    - name: "unit"
      type: "string"
      description: "Unit of measurement"
    - name: "trend"
      type: "object"
      description: "Trend information"
  validation:
    - rule: "label must not be empty"
      fallback: "Unnamed data point"
    - rule: "value must be a number"
      fallback: "0"
```

**Best Practices:**
- Clearly separate required and optional fields
- Include data types for each field
- Document validation rules and fallbacks
- Describe the purpose of each field

### Examples

Provide usage examples with different props.

```yaml
examples:
  - name: "Basic Usage"
    description: "Standard data card with value and label"
    props:
      id: "revenue"
      label: "Monthly Revenue"
      value: 12500
      unit: "$"
    preview_image: "/examples/data-card-basic.png"
  
  - name: "With Trend"
    description: "Data card showing trend information"
    props:
      id: "users"
      label: "Active Users"
      value: 2750
      trend:
        direction: "up"
        percentage: 12.3
    preview_image: "/examples/data-card-trend.png"
```

**Best Practices:**
- Include examples covering common use cases
- Add examples for different states (loading, error, etc.)
- Provide realistic data values
- Include preview images when possible

## Advanced Documentation

### Performance Considerations

Document performance optimizations for the component.

```yaml
performance:
  rendering:
    ssr: true
    lazy_load: false
  optimization:
    memoization: true
    render_control: "Only re-render on value changes"
  thresholds:
    max_items: 100
```

**Best Practices:**
- Specify rendering strategy (SSR, CSR, etc.)
- Document optimization techniques
- Include performance thresholds or limits

### Error Handling

Detail how the component handles errors.

```yaml
error_handling:
  scenarios:
    - error: "data_load_failed"
      action: "Show error message"
      retry:
        automatic: false
        user_triggered: true
      fallback: "Show previous data if available"
    - error: "validation_failed"
      action: "Show validation message"
      fallback: "Use default values"
```

**Best Practices:**
- Document all error scenarios
- Specify user-facing error messages
- Include retry mechanisms
- Define fallback behaviors

### Testing Specifications

Define testing requirements for the component.

```yaml
testing:
  unit_tests:
    scenarios:
      - description: "renders in loading state"
        props: "{ loading: true }"
        expected: "shows skeleton loader"
      - description: "formats large numbers correctly"
        props: "{ value: 1234567 }"
        expected: "shows '1,234,567'"
  accessibility_tests:
    - "keyboard navigation works correctly"
    - "screen readers announce value changes"
  visual_regression:
    critical_states:
      - "loading"
      - "error"
      - "success"
```

**Best Practices:**
- Include test scenarios for key functionality
- Specify accessibility testing requirements
- Include visual regression testing for all states
- Document edge cases that require testing

## Conclusion

This specification guide provides a framework for creating detailed, useful design documentation. Remember that documentation is most effective when it's:

1. **Accurate**: Reflects the current state of the design
2. **Comprehensive**: Covers all important aspects
3. **Accessible**: Easy to understand and navigate
4. **Maintained**: Updated as the design evolves

By following these guidelines, you'll create documentation that serves as effective context anchoring for AI agents and provides clear guidance for your development team.