/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FileUpload from '../components/FileUpload';

describe('FileUpload Component', () => {
  it('should render file upload area', () => {
    const mockHandler = vi.fn();
    render(<FileUpload onFileUpload={mockHandler} />);

    expect(screen.getByLabelText(/Upload Credit Card Statement/i)).toBeInTheDocument();
    expect(screen.getByText(/Drop CSV here or/i)).toBeInTheDocument();
  });

  it('should render file input with correct attributes', () => {
    const mockHandler = vi.fn();
    render(<FileUpload onFileUpload={mockHandler} />);

    const input = screen.getByLabelText(/Upload Credit Card Statement/i);
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'file');
    expect(input).toHaveAttribute('accept', '.csv');
  });

  it('should accept CSV files only', () => {
    const mockHandler = vi.fn();
    render(<FileUpload onFileUpload={mockHandler} />);

    const input = screen.getByLabelText(/Upload Credit Card Statement/i);
    expect(input).toHaveAttribute('accept', '.csv');
  });

  it('should call onFileUpload when valid CSV file selected', async () => {
    const mockHandler = vi.fn();
    render(<FileUpload onFileUpload={mockHandler} />);

    const file = new File(['test content'], 'test.csv', { type: 'text/csv' });
    const input = screen.getByLabelText(/Upload Credit Card Statement/i);

    fireEvent.change(input, { target: { files: [file] } });

    expect(mockHandler).toHaveBeenCalledWith(file);
  });

  it('should show alert for invalid file type when no onError callback', async () => {
    const mockHandler = vi.fn();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    render(<FileUpload onFileUpload={mockHandler} />);

    const file = new File(['test'], 'test.txt', { type: 'text/plain' });
    const input = screen.getByLabelText(/Upload Credit Card Statement/i);

    fireEvent.change(input, { target: { files: [file] } });

    expect(alertSpy).toHaveBeenCalledWith('Please upload a valid CSV file.');
    expect(mockHandler).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it('should call onError callback for invalid file type', async () => {
    const mockUploadHandler = vi.fn();
    const mockErrorHandler = vi.fn();

    render(<FileUpload onFileUpload={mockUploadHandler} onError={mockErrorHandler} />);

    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    const input = screen.getByLabelText(/Upload Credit Card Statement/i);

    fireEvent.change(input, { target: { files: [file] } });

    expect(mockErrorHandler).toHaveBeenCalledWith('Please upload a valid CSV file.');
    expect(mockUploadHandler).not.toHaveBeenCalled();
  });

  it('should not show alert when onError callback is provided', async () => {
    const mockUploadHandler = vi.fn();
    const mockErrorHandler = vi.fn();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    render(<FileUpload onFileUpload={mockUploadHandler} onError={mockErrorHandler} />);

    const file = new File(['test'], 'test.txt', { type: 'text/plain' });
    const input = screen.getByLabelText(/Upload Credit Card Statement/i);

    fireEvent.change(input, { target: { files: [file] } });

    expect(mockErrorHandler).toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it('should display selected file name', async () => {
    const mockHandler = vi.fn();
    render(<FileUpload onFileUpload={mockHandler} />);

    const file = new File(['test'], 'statement.csv', { type: 'text/csv' });
    const input = screen.getByLabelText(/Upload Credit Card Statement/i);

    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByText('statement.csv')).toBeInTheDocument();
  });

  it('should display file size in correct format', async () => {
    const mockHandler = vi.fn();
    render(<FileUpload onFileUpload={mockHandler} />);

    // Create 2KB file
    const content = 'a'.repeat(2048);
    const file = new File([content], 'test.csv', { type: 'text/csv' });
    const input = screen.getByLabelText(/Upload Credit Card Statement/i);

    fireEvent.change(input, { target: { files: [file] } });

    // Should display size in KB
    expect(screen.getByText(/\d+\.\d+ KB/)).toBeInTheDocument();
  });

  it('should show file type as CSV', async () => {
    const mockHandler = vi.fn();
    render(<FileUpload onFileUpload={mockHandler} />);

    const file = new File(['test'], 'test.csv', { type: 'text/csv' });
    const input = screen.getByLabelText(/Upload Credit Card Statement/i);

    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByText(/CSV File/)).toBeInTheDocument();
  });

  it('should allow file removal', async () => {
    const mockHandler = vi.fn();
    render(<FileUpload onFileUpload={mockHandler} />);

    const file = new File(['test'], 'test.csv', { type: 'text/csv' });
    const input = screen.getByLabelText(/Upload Credit Card Statement/i);

    fireEvent.change(input, { target: { files: [file] } });

    // File should be displayed
    expect(screen.getByText('test.csv')).toBeInTheDocument();

    // Remove file
    const removeButton = screen.getByLabelText('Remove file');
    fireEvent.click(removeButton);

    // File should be removed, prompt should be shown again
    expect(screen.queryByText('test.csv')).not.toBeInTheDocument();
    expect(screen.getByText(/Drop CSV here or/i)).toBeInTheDocument();
  });

  it('should handle drag and drop events', async () => {
    const mockHandler = vi.fn();
    render(<FileUpload onFileUpload={mockHandler} />);

    const uploadZone = screen.getByLabelText(/Upload Credit Card Statement/i).closest('.upload-zone');
    const file = new File(['test'], 'test.csv', { type: 'text/csv' });

    // Simulate drag enter
    fireEvent.dragEnter(uploadZone, {
      dataTransfer: { files: [file] }
    });

    expect(uploadZone).toHaveClass('dragging');

    // Simulate drop
    fireEvent.drop(uploadZone, {
      dataTransfer: { files: [file] }
    });

    expect(mockHandler).toHaveBeenCalledWith(file);
    expect(uploadZone).not.toHaveClass('dragging');
  });

  it('should remove dragging class on drag leave', () => {
    const mockHandler = vi.fn();
    render(<FileUpload onFileUpload={mockHandler} />);

    const uploadZone = screen.getByLabelText(/Upload Credit Card Statement/i).closest('.upload-zone');

    // Simulate drag enter
    fireEvent.dragEnter(uploadZone);
    expect(uploadZone).toHaveClass('dragging');

    // Simulate drag leave
    fireEvent.dragLeave(uploadZone);
    expect(uploadZone).not.toHaveClass('dragging');
  });

  it('should format file sizes correctly', async () => {
    const mockHandler = vi.fn();
    const { rerender } = render(<FileUpload onFileUpload={mockHandler} />);

    // Test bytes
    const smallFile = new File(['a'.repeat(100)], 'small.csv', { type: 'text/csv' });
    const input = screen.getByLabelText(/Upload Credit Card Statement/i);
    fireEvent.change(input, { target: { files: [smallFile] } });
    expect(screen.getByText(/\d+ B/)).toBeInTheDocument();

    // Test KB
    rerender(<FileUpload onFileUpload={mockHandler} />);
    const mediumFile = new File(['a'.repeat(2048)], 'medium.csv', { type: 'text/csv' });
    const input2 = screen.getByLabelText(/Upload Credit Card Statement/i);
    fireEvent.change(input2, { target: { files: [mediumFile] } });
    expect(screen.getByText(/\d+\.\d+ KB/)).toBeInTheDocument();
  });

  it('should show has-file class when file is selected', async () => {
    const mockHandler = vi.fn();
    render(<FileUpload onFileUpload={mockHandler} />);

    const uploadZone = screen.getByLabelText(/Upload Credit Card Statement/i).closest('.upload-zone');
    const file = new File(['test'], 'test.csv', { type: 'text/csv' });
    const input = screen.getByLabelText(/Upload Credit Card Statement/i);

    fireEvent.change(input, { target: { files: [file] } });

    expect(uploadZone).toHaveClass('has-file');
  });

  it('should display upload icon SVG', () => {
    const mockHandler = vi.fn();
    const { container } = render(<FileUpload onFileUpload={mockHandler} />);
    
    const iconContainer = container.querySelector('.upload-icon');
    expect(iconContainer.querySelector('svg')).toBeInTheDocument();
  });

  it('should display upload prompt text', () => {
    const mockHandler = vi.fn();
    render(<FileUpload onFileUpload={mockHandler} />);

    expect(screen.getByText(/Drop CSV here or/i)).toBeInTheDocument();
  });

  it('should show success icon when file is selected', async () => {
    const mockHandler = vi.fn();
    const { container } = render(<FileUpload onFileUpload={mockHandler} />);

    const file = new File(['test'], 'test.csv', { type: 'text/csv' });
    const input = screen.getByLabelText(/Upload Credit Card Statement/i);

    fireEvent.change(input, { target: { files: [file] } });

    const iconContainer = container.querySelector('.file-preview-icon');
    expect(iconContainer.querySelector('svg')).toBeInTheDocument();
  });

  it('should show upload icon when no file is selected', () => {
    const mockHandler = vi.fn();
    const { container } = render(<FileUpload onFileUpload={mockHandler} />);

    const iconContainer = container.querySelector('.upload-icon');
    expect(iconContainer.querySelector('svg')).toBeInTheDocument();
  });

  it('should handle multiple file selection by only accepting first file', async () => {
    const mockHandler = vi.fn();
    render(<FileUpload onFileUpload={mockHandler} />);

    const file1 = new File(['test1'], 'test1.csv', { type: 'text/csv' });
    const input = screen.getByLabelText(/Upload Credit Card Statement/i);

    fireEvent.change(input, { target: { files: [file1] } });

    expect(mockHandler).toHaveBeenCalledWith(file1);
    expect(screen.getByText('test1.csv')).toBeInTheDocument();
  });

  it('should not call onFileUpload for invalid files', async () => {
    const mockHandler = vi.fn();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    render(<FileUpload onFileUpload={mockHandler} />);

    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    const input = screen.getByLabelText(/Upload Credit Card Statement/i);

    fireEvent.change(input, { target: { files: [file] } });

    expect(mockHandler).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });
});
