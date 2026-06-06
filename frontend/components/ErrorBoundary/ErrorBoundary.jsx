
import { Component } from 'react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div style={{ padding: '24px', color: '#F6465D', fontSize: '14px' }}>
          Something went wrong displaying this section.
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{ marginLeft: '12px', cursor: 'pointer', textDecoration: 'underline', background: 'none', border: 'none', color: '#4F7EF7' }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
