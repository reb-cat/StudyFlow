import { Button } from '@/components/ui/button';
import { User } from 'lucide-react';
import { Link } from 'wouter';

export default function StudentSelection() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
      <div className="w-full max-w-2xl px-8">
        {/* Clean Header */}
        <div className="text-center mb-16">
          <h1 className="text-3xl font-light text-gray-900 dark:text-white mb-3">
            Choose Your Student
          </h1>
        </div>

        {/* Simple Student Cards */}
        <div className="space-y-6">
          {/* Abigail's Card */}
          <Link href="/student/abigail">
            <div className="group cursor-pointer">
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md hover:border-gray-200 dark:hover:border-gray-600 transition-all duration-200">
                <div className="flex items-center space-x-6">
                  {/* Profile Icon */}
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                    <User className="w-8 h-8 text-gray-600 dark:text-gray-400" />
                  </div>
                  
                  {/* Name */}
                  <div className="flex-1">
                    <h2 className="text-2xl font-medium text-gray-900 dark:text-white">
                      Abigail
                    </h2>
                  </div>
                  
                  {/* Action Button */}
                  <Button 
                    className="bg-gray-900 hover:bg-gray-800 text-white px-6 py-2 rounded-lg group-hover:scale-105 transition-transform duration-200"
                    data-testid="button-select-abigail"
                  >
                    Let's Go
                  </Button>
                </div>
                
                {/* Subtle Progress Indicator */}
                <div className="mt-4 ml-22">
                  <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1">
                    <div className="bg-gray-300 dark:bg-gray-600 h-1 rounded-full" style={{width: '15%'}}></div>
                  </div>
                </div>
              </div>
            </div>
          </Link>

          {/* Khalil's Card */}
          <Link href="/student/khalil">
            <div className="group cursor-pointer">
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md hover:border-gray-200 dark:hover:border-gray-600 transition-all duration-200">
                <div className="flex items-center space-x-6">
                  {/* Profile Icon */}
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                    <User className="w-8 h-8 text-gray-600 dark:text-gray-400" />
                  </div>
                  
                  {/* Name */}
                  <div className="flex-1">
                    <h2 className="text-2xl font-medium text-gray-900 dark:text-white">
                      Khalil
                    </h2>
                  </div>
                  
                  {/* Action Button */}
                  <Button 
                    className="bg-gray-900 hover:bg-gray-800 text-white px-6 py-2 rounded-lg group-hover:scale-105 transition-transform duration-200"
                    data-testid="button-select-khalil"
                  >
                    Let's Go
                  </Button>
                </div>
                
                {/* Subtle Progress Indicator */}
                <div className="mt-4 ml-22">
                  <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1">
                    <div className="bg-gray-300 dark:bg-gray-600 h-1 rounded-full" style={{width: '35%'}}></div>
                  </div>
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* Minimal Footer */}
        <div className="text-center mt-12">
          <Link href="/admin">
            <Button variant="ghost" className="text-gray-400 hover:text-gray-600 text-sm" data-testid="link-admin-panel">
              Admin
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}