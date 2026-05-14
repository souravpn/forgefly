import { describe, it, expect, vi } from 'vitest';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { render } from '@testing-library/react';

describe('UI Components', () => {
  it('renders Button component', () => {
    const { container } = render(<Button onClick={vi.fn()}>Click me</Button>);
    expect(container.querySelector('button')).toBeTruthy();
  });

  it('renders Card component', () => {
    const { container } = render(<Card>Card content</Card>);
    expect(container.firstChild).toBeTruthy();
  });

  it('Button accepts variant prop', () => {
    const { container } = render(
      <Button variant="outline" onClick={vi.fn()}>
        Outline
      </Button>
    );
    const button = container.querySelector('button');
    expect(button).toBeTruthy();
  });

  it('Button accepts size prop', () => {
    const { container } = render(
      <Button size="lg" onClick={vi.fn()}>
        Large
      </Button>
    );
    const button = container.querySelector('button');
    expect(button).toBeTruthy();
  });
});
