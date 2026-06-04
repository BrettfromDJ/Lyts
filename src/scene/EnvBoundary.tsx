import { Component, type ReactNode } from 'react';

/**
 * Isolates the HDRI <Environment> so a failed fetch (offline / blocked CDN)
 * degrades gracefully to "no environment" instead of blanking the whole scene.
 */
export class EnvBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    /* swallow — grounding just falls back to floor + shadow */
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
