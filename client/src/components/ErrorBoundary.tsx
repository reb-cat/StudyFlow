import { Component, ReactNode } from 'react';

export class ErrorBoundary extends Component<{children:ReactNode}, {err?:Error}> {
  state = { err: undefined as Error|undefined };
  
  static getDerivedStateFromError(err: Error) { 
    return { err }; 
  }
  
  componentDidCatch(err: Error, info: any) { 
    console.error('[ReactBoundary]', err, info); 
  }
  
  render() {
    if (this.state.err) {
      return (
        <div style={{padding: 16, backgroundColor: '#fee', color: '#900'}}>
          <h2>Something went wrong.</h2>
          <pre style={{whiteSpace:'pre-wrap'}}>{this.state.err.message}</pre>
          <details>
            <summary>Stack trace</summary>
            <pre style={{whiteSpace:'pre-wrap', fontSize: '12px'}}>{this.state.err.stack}</pre>
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}