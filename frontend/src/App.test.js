import { render, screen } from '@testing-library/react';
import App from './App';

test('renders dashboard header', () => {
  render(<App />);
  const headerElement = screen.getByText(/Financial Data Dashboard/i);
  expect(headerElement).toBeInTheDocument();
});
