import { StrictMode, Component } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";

class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            background: "#0c0c0c",
            color: "#e0d0ff",
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "system-ui, sans-serif",
            padding: "2rem",
            textAlign: "center",
          }}
        >
          <h1 style={{ color: "#ff6b6b", marginBottom: "1rem" }}>
            Something went wrong
          </h1>
          <pre
            style={{
              color: "#e0d0ff",
              opacity: 0.7,
              maxWidth: "80vw",
              overflow: "auto",
              marginBottom: "2rem",
              fontSize: "0.85rem",
            }}
          >
            {this.state.error.message}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: "#e0d0ff",
              color: "#0c0c0c",
              border: "none",
              padding: "0.75rem 2rem",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "1rem",
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById("root");
const root = createRoot(rootElement);

root.render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
