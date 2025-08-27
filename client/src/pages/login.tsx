import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff, LogIn, ArrowLeft } from "lucide-react";

// Login form schema
const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginForm) => {
      return await apiRequest('POST', '/api/login', data);
    },
    onSuccess: (response) => {
      const user = response.user;
      toast({
        title: "Welcome back!",
        description: "You have successfully signed in.",
      });
      
      // Redirect based on user role
      if (user.role === 'admin' || user.role === 'parent') {
        navigate("/admin");
      } else {
        navigate("/student"); // Default for students
      }
    },
    onError: (error) => {
      toast({
        title: "Login failed",
        description: error.message || "Invalid email or password. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: LoginForm) => {
    loginMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{
      background: 'linear-gradient(135deg, var(--surface) 0%, var(--surface-elevated) 100%)'
    }}>
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center mb-6 text-decoration-none">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold mr-3 shadow-lg" style={{
              background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)'
            }}>
              S
            </div>
            <span className="text-3xl font-bold" style={{ color: 'var(--primary)' }}>StudyFlow</span>
          </Link>
          
          <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            Welcome back
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Sign in to continue to StudyFlow
          </p>
        </div>

        {/* Login Form */}
        <Card className="shadow-xl border-0" style={{
          background: 'var(--surface-elevated)',
          borderColor: 'var(--border-subtle)'
        }}>
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              Sign in
            </CardTitle>
            <CardDescription style={{ color: 'var(--text-secondary)' }}>
              Enter your email and password to access your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" style={{ color: 'var(--text-primary)' }}>
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  {...form.register("email")}
                  data-testid="input-email"
                  style={{
                    background: 'var(--surface)',
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-primary)'
                  }}
                />
                {form.formState.errors.email && (
                  <p className="text-sm text-red-500" data-testid="error-email">
                    {form.formState.errors.email.message}
                  </p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password" style={{ color: 'var(--text-primary)' }}>
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    {...form.register("password")}
                    data-testid="input-password"
                    style={{
                      background: 'var(--surface)',
                      borderColor: 'var(--border-subtle)',
                      color: 'var(--text-primary)',
                      paddingRight: '2.5rem'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    data-testid="button-toggle-password"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {form.formState.errors.password && (
                  <p className="text-sm text-red-500" data-testid="error-password">
                    {form.formState.errors.password.message}
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full py-3 font-semibold text-white shadow-lg hover:shadow-xl transition-all duration-200"
                disabled={loginMutation.isPending}
                data-testid="button-login"
                style={{
                  background: loginMutation.isPending 
                    ? 'var(--surface-secondary)'
                    : 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)'
                }}
              >
                {loginMutation.isPending ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Signing in...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <LogIn size={18} />
                    Sign In
                  </div>
                )}
              </Button>
            </form>

            {/* Register Link */}
            <div className="mt-6 text-center">
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Don't have an account?{" "}
                <Link href="/register" className="font-medium hover:underline" style={{ color: 'var(--primary)' }}>
                  Sign up
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Back to Home */}
        <div className="mt-6 text-center">
          <Link 
            href="/" 
            className="inline-flex items-center gap-2 text-sm hover:underline"
            style={{ color: 'var(--text-secondary)' }}
            data-testid="link-back-home"
          >
            <ArrowLeft size={16} />
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}