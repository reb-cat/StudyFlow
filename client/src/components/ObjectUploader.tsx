import { useState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X } from "lucide-react";

interface ObjectUploaderProps {
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  onGetUploadParameters: () => Promise<{
    method: "PUT";
    url: string;
  }>;
  onComplete?: (uploadedUrl: string) => void;
  buttonClassName?: string;
  children: ReactNode;
  accept?: string;
}

/**
 * A file upload component that renders as a button and provides a simple
 * file upload interface.
 */
export function ObjectUploader({
  maxNumberOfFiles = 1,
  maxFileSize = 10485760, // 10MB default
  onGetUploadParameters,
  onComplete,
  buttonClassName,
  children,
  accept = "image/*",
}: ObjectUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showModal, setShowModal] = useState(false);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > maxFileSize) {
      alert(`File too large. Maximum size is ${Math.round(maxFileSize / 1024 / 1024)}MB`);
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      // Get upload URL from backend
      const { url } = await onGetUploadParameters();

      // Upload file directly to storage
      const response = await fetch(url, {
        method: 'PUT',
        body: selectedFile,
        headers: {
          'Content-Type': selectedFile.type,
        },
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }

      // Extract object path from the upload URL
      const uploadedUrl = url.split('?')[0]; // Remove query params to get clean URL
      
      onComplete?.(uploadedUrl);
      setShowModal(false);
      setSelectedFile(null);
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <Button 
        onClick={() => setShowModal(true)} 
        className={buttonClassName}
        variant="outline"
      >
        {children}
      </Button>

      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
                Upload Profile Image
              </h3>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <input
                type="file"
                accept={accept}
                onChange={handleFileSelect}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px dashed #e9ecef',
                  borderRadius: '8px',
                  textAlign: 'center',
                  cursor: 'pointer'
                }}
              />
              {selectedFile && (
                <div style={{
                  marginTop: '12px',
                  padding: '8px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}>
                  Selected: {selectedFile.name}
                </div>
              )}
            </div>

            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end'
            }}>
              <Button
                variant="outline"
                onClick={() => setShowModal(false)}
                disabled={isUploading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                disabled={!selectedFile || isUploading}
              >
                {isUploading ? 'Uploading...' : 'Upload'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}