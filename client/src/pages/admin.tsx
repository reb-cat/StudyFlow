import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, Lock, Eye, EyeOff } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accessKey, setAccessKey] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    success: boolean;
    message: string;
    details?: any;
  } | null>(null);
  const { toast } = useToast();

  // Check for existing auth on component mount
  useEffect(() => {
    const savedAuth = localStorage.getItem('admin-auth');
    if (savedAuth) {
      setIsAuthenticated(true);
    }
  }, []);

  const handleAuth = async () => {
    try {
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessKey })
      });

      if (response.ok) {
        setIsAuthenticated(true);
        setAuthError('');
        localStorage.setItem('admin-auth', 'true');
        toast({
          title: "Access Granted",
          description: "Welcome to StudyFlow Admin"
        });
      } else {
        const error = await response.json();
        setAuthError(error.message || 'Invalid access key');
        toast({
          title: "Access Denied",
          description: "Invalid access key",
          variant: "destructive"
        });
      }
    } catch (error) {
      setAuthError('Connection error');
      toast({
        title: "Error",
        description: "Unable to verify access key",
        variant: "destructive"
      });
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setAccessKey('');
    localStorage.removeItem('admin-auth');
    toast({
      title: "Logged Out",
      description: "Admin session ended"
    });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type === 'text/csv' || selectedFile.name.endsWith('.csv')) {
        setFile(selectedFile);
        setUploadResult(null);
      } else {
        toast({
          title: "Invalid File Type",
          description: "Please select a CSV file",
          variant: "destructive"
        });
      }
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('csvFile', file);

      const response = await fetch('/api/admin/upload-schedule', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (response.ok) {
        setUploadResult({
          success: true,
          message: `Successfully updated schedule template`,
          details: result
        });
        toast({
          title: "Upload Successful",
          description: `Updated ${result.rowsAffected || 0} schedule entries`
        });
        setFile(null);
        // Reset file input
        const fileInput = document.getElementById('csv-file') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      } else {
        setUploadResult({
          success: false,
          message: result.message || 'Upload failed',
          details: result
        });
        toast({
          title: "Upload Failed",
          description: result.message || 'Failed to update schedule',
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadResult({
        success: false,
        message: 'Network error occurred during upload'
      });
      toast({
        title: "Upload Error",
        description: "A network error occurred",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Show login form if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>StudyFlow Admin Access</CardTitle>
            <CardDescription>Enter your access key to continue</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="access-key">Access Key</Label>
              <div className="relative">
                <Input
                  id="access-key"
                  type={showPassword ? "text" : "password"}
                  value={accessKey}
                  onChange={(e) => setAccessKey(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
                  placeholder="Enter access key"
                  data-testid="input-access-key"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {authError && (
              <Alert className="border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">{authError}</AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleAuth}
              disabled={!accessKey.trim()}
              className="w-full"
              data-testid="button-admin-login"
            >
              <Lock className="h-4 w-4 mr-2" />
              Access Admin Panel
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">StudyFlow Admin</h1>
            <p className="text-muted-foreground">Manage schedule templates and system settings</p>
          </div>
          <Button variant="outline" onClick={handleLogout} data-testid="button-logout">
            <Lock className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>

        {/* CSV Upload Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Schedule Template Upload
            </CardTitle>
            <CardDescription>
              Upload a CSV file to update the permanent schedule template. This creates a reusable weekly schedule that's not tied to specific dates. 
              CSV should include: student_name, weekday, block_number, start_time, end_time, subject, block_type
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="csv-file">CSV File</Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="cursor-pointer"
                data-testid="input-csv-file"
              />
            </div>

            {file && (
              <Alert>
                <FileSpreadsheet className="h-4 w-4" />
                <AlertDescription>
                  Selected file: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
                </AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleUpload}
              disabled={!file || isUploading}
              className="w-full"
              data-testid="button-upload-csv"
            >
              {isUploading ? (
                <>
                  <Upload className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Schedule Template
                </>
              )}
            </Button>

            {/* Upload Result Display */}
            {uploadResult && (
              <Alert className={uploadResult.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
                {uploadResult.success ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                )}
                <AlertDescription className={uploadResult.success ? "text-green-800" : "text-red-800"}>
                  <strong>{uploadResult.success ? "Success:" : "Error:"}</strong> {uploadResult.message}
                  {uploadResult.details && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm">View Details</summary>
                      <pre className="mt-1 text-xs bg-white/50 p-2 rounded overflow-x-auto">
                        {JSON.stringify(uploadResult.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* CSV Format Guide */}
        <Card>
          <CardHeader>
            <CardTitle>CSV Format Guide</CardTitle>
            <CardDescription>Expected CSV format for schedule template uploads</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <h4 className="font-semibold mb-2">Required Columns:</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li><code>student_name</code> - Student name (e.g., "Abigail", "Khalil")</li>
                  <li><code>weekday</code> - Day of week (e.g., "Monday", "Tuesday")</li>
                  <li><code>block_number</code> - Block number or leave empty for non-numbered blocks</li>
                  <li><code>start_time</code> - Start time in HH:MM or HH:MM:SS format (e.g., "09:00" or "09:00:00")</li>
                  <li><code>end_time</code> - End time in HH:MM or HH:MM:SS format (e.g., "09:30" or "09:30:00")</li>
                  <li><code>subject</code> - Subject or activity name</li>
                  <li><code>block_type</code> - Type of block (e.g., "Assignment", "Bible", "Movement", "Co-Op")</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-semibold mb-2">Example CSV Row:</h4>
                <code className="text-xs bg-muted p-2 rounded block">
                  Abigail,Tuesday,1,09:00,09:20,Bible,Bible
                </code>
                <p className="text-xs text-muted-foreground mt-1">
                  Note: Times automatically converted to database format. This creates a permanent weekly template.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}