import React from 'react';

type ErrorBoundaryProps = {
  children: React.ReactNode;
};

type ErrorBoundaryState = {
  error: Error | null;
};

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Erro capturado pelo app:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="center-screen setup-warning">
          <h1>O app travou nessa tela</h1>
          <p>Recarregue a página. Se persistir, copie a mensagem abaixo para investigar.</p>
          <pre>{this.state.error.message}</pre>
        </div>
      );
    }

    return this.props.children;
  }
}
