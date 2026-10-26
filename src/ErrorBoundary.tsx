import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
	children: ReactNode;
}

interface State {
	error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
	state: State = { error: null };

	static getDerivedStateFromError(error: Error): State {
		return { error };
	}

	componentDidCatch(error: Error, info: ErrorInfo) {
		console.error("NIH Layout Studio error", error, info);
	}

	render() {
		if (!this.state.error)
			return this.props.children;

		return (
			<div style={{ padding: 24, color: "#dbe6f2", background: "#0a0f16", minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>
				<h1>NIH Layout Studio encountered an error</h1>
				<p>The selected file may be malformed or unsupported. Your local files were not uploaded.</p>
				<pre style={{ whiteSpace: "pre-wrap", color: "#ffb4b4" }}>{this.state.error.message}</pre>
				<button onClick={() => window.location.reload()}>Reload Layout Studio</button>
			</div>
		);
	}
}
