"use client";
import { Component, type ReactNode } from "react";
/** Keeps educational navigation available when a chunk or renderer fails. */
export default class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <div className="scene-message" role="alert"><h3>The 3D view could not load</h3><p>You can still explore all 17 structures in the learning panel. Try reloading with graphics acceleration enabled.</p><button type="button" className="control" onClick={() => window.location.reload()}>Reload viewer</button></div>;
    return this.props.children;
  }
}
