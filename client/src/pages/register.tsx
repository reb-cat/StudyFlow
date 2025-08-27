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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff, UserPlus, ArrowLeft } from "lucide-react";

// Enhanced registration form schema with comprehensive validation
const registerSchema = z.object({
  firstName: z.string()
    .min(1, "First name is required")
    .max(50, "First name must be less than 50 characters")
    .regex(/^[a-zA-Z\s-']+$/, "First name can only contain letters, spaces, hyphens and apostrophes"),
  lastName: z.string()
    .min(1, "Last name is required")
    .max(50, "Last name must be less than 50 characters")
    .regex(/^[a-zA-Z\s-']+$/, "Last name can only contain letters, spaces, hyphens and apostrophes"),
  email: z.string()
    .min(1, "Email is required")
    .email("Please enter a valid email address")
    .max(100, "Email must be less than 100 characters")
    .toLowerCase()
    .trim(),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password must be less than 100 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterForm) => {
      // Log validation data for debugging
      console.log("[Registration] Submitting form data:", {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        passwordLength: data.password.length,
        timestamp: new Date().toISOString()
      });

      // Validate all fields before submission
      const validationErrors: string[] = [];
      
      if (!data.firstName?.trim()) validationErrors.push("First name is empty");
      if (!data.lastName?.trim()) validationErrors.push("Last name is empty");
      if (!data.email?.trim()) validationErrors.push("Email is empty");
      if (!data.password) validationErrors.push("Password is empty");
      
      if (validationErrors.length > 0) {
        const errorMsg = `Client validation failed: ${validationErrors.join(", ")}`;
        console.error("[Registration]", errorMsg);
        throw new Error(errorMsg);
      }

      const { confirmPassword, ...userData } = data;
      
      // Clean and normalize data
      const cleanedData = {
        firstName: userData.firstName.trim(),
        lastName: userData.lastName.trim(),
        email: userData.email.toLowerCase().trim(),
        password: userData.password
      };
      
      console.log("[Registration] Sending cleaned data to server");
      
      try {
        const response = await apiRequest('POST', '/api/register', cleanedData);
        console.log("[Registration] Success response:", response);
        return response;
      } catch (error: any) {
        console.error("[Registration] Server error:", {
          message: error.message,
          status: error.status,
          response: error.response,
          timestamp: new Date().toISOString()
        });
        throw error;
      }
    },
    onSuccess: (response) => {
      console.log("[Registration] Account created successfully:", response);
      toast({
        title: "Registration successful!",
        description: "Your account has been created. Please sign in.",
      });
      navigate("/login");
    },
    onError: (error: any) => {
      console.error("[Registration] Final error handler:", error);
      
      // Parse different error types
      let errorMessage = "Something went wrong. Please try again.";
      
      if (error.message?.includes("email already exists") || error.message?.includes("account with this email")) {
        errorMessage = "An account with this email already exists. Please use a different email or sign in.";
      } else if (error.message?.includes("validation")) {
        errorMessage = error.message;
      } else if (error.message?.includes("network") || error.message?.includes("fetch")) {
        errorMessage = "Network error. Please check your connection and try again.";
      } else if (error.message?.includes("400")) {
        errorMessage = "Invalid registration data. Please check all fields and try again.";
      } else if (error.message?.includes("500")) {
        errorMessage = "Server error. Please try again later.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Registration failed",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: RegisterForm) => {
    console.log("[Registration] Form submitted with data:", {
      fields: Object.keys(data),
      hasAllFields: !!(data.firstName && data.lastName && data.email && data.password && data.confirmPassword),
      formErrors: form.formState.errors,
      timestamp: new Date().toISOString()
    });
    
    // Additional client-side checks
    if (form.formState.errors && Object.keys(form.formState.errors).length > 0) {
      console.error("[Registration] Form has validation errors:", form.formState.errors);
      return;
    }
    
    registerMutation.mutate(data);
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
            Create your account
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Join StudyFlow to get started with your learning journey
          </p>
        </div>

        {/* Registration Form */}
        <Card className="shadow-xl border-0" style={{
          background: 'var(--surface-elevated)',
          borderColor: 'var(--border-subtle)'
        }}>
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              Sign up
            </CardTitle>
            <CardDescription style={{ color: 'var(--text-secondary)' }}>
              Fill in your information to create an account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* First Name */}
              <div className="space-y-2">
                <Label htmlFor="firstName" style={{ color: 'var(--text-primary)' }}>
                  First Name *
                </Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder="Enter your first name"
                  {...form.register("firstName")}
                  data-testid="input-first-name"
                  style={{
                    background: 'var(--surface)',
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-primary)'
                  }}
                />
                {form.formState.errors.firstName && (
                  <p className="text-sm text-red-500" data-testid="error-first-name">
                    {form.formState.errors.firstName.message}
                  </p>
                )}
              </div>

              {/* Last Name */}
              <div className="space-y-2">
                <Label htmlFor="lastName" style={{ color: 'var(--text-primary)' }}>
                  Last Name *
                </Label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Enter your last name"
                  {...form.register("lastName")}
                  data-testid="input-last-name"
                  style={{
                    background: 'var(--surface)',
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-primary)'
                  }}
                />
                {form.formState.errors.lastName && (
                  <p className="text-sm text-red-500" data-testid="error-last-name">
                    {form.formState.errors.lastName.message}
                  </p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" style={{ color: 'var(--text-primary)' }}>
                  Email Address *
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
                  Password *
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a password (min. 8 characters)"
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

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" style={{ color: 'var(--text-primary)' }}>
                  Confirm Password *
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Re-enter your password"
                    {...form.register("confirmPassword")}
                    data-testid="input-confirm-password"
                    style={{
                      background: 'var(--surface)',
                      borderColor: 'var(--border-subtle)',
                      color: 'var(--text-primary)',
                      paddingRight: '2.5rem'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    data-testid="button-toggle-confirm-password"
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {form.formState.errors.confirmPassword && (
                  <p className="text-sm text-red-500" data-testid="error-confirm-password">
                    {form.formState.errors.confirmPassword.message}
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full py-3 font-semibold text-white shadow-lg hover:shadow-xl transition-all duration-200"
                disabled={registerMutation.isPending}
                data-testid="button-register"
                style={{
                  background: registerMutation.isPending 
                    ? 'var(--surface-secondary)'
                    : 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)'
                }}
              >
                {registerMutation.isPending ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Creating account...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <UserPlus size={18} />
                    Create Account
                  </div>
                )}
              </Button>
            </form>

            {/* Sign In Link */}
            <div className="mt-6 text-center">
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Already have an account?{" "}
                <Link href="/login" className="font-medium hover:underline" style={{ color: 'var(--primary)' }}>
                  Sign in
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