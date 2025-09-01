import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AdminAuthProps {
  children: React.ReactNode;
}

const ADMIN_CODE = "1234"; // Simple 4-digit code - could be made configurable

export default function AdminAuth({ children }: AdminAuthProps) {
  const [code, setCode] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    // Check if admin is already authenticated in this session
    return sessionStorage.getItem('adminAuthenticated') === 'true';
  });
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (code === ADMIN_CODE) {
      setIsAuthenticated(true);
      sessionStorage.setItem('adminAuthenticated', 'true');
      toast({
        title: "Access Granted",
        description: "Welcome to the admin panel",
        variant: "default"
      });
    } else {
      toast({
        title: "Access Denied", 
        description: "Invalid admin code",
        variant: "destructive"
      });
      setCode('');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('adminAuthenticated');
    setCode('');
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <Shield className="h-8 w-8 text-blue-600" />
            </div>
            <CardTitle className="text-2xl font-bold">Admin Access</CardTitle>
            <p className="text-gray-600">Enter the 4-digit admin code to continue</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Input
                  type="password"
                  placeholder="Enter 4-digit code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  maxLength={4}
                  className="text-center text-2xl tracking-widest font-mono"
                  autoFocus
                  data-testid="input-admin-code"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full"
                disabled={code.length !== 4}
                data-testid="button-submit-admin-code"
              >
                <Lock className="h-4 w-4 mr-2" />
                Access Admin Panel
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Logout button in top-right corner */}
      <div className="fixed top-4 right-4 z-50">
        <Button
          variant="outline"
          size="sm"
          onClick={handleLogout}
          className="bg-white shadow-md"
          data-testid="button-admin-logout"
        >
          <Lock className="h-4 w-4 mr-2" />
          Lock Admin
        </Button>
      </div>
      {children}
    </div>
  );
}