import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, BookOpen, Calendar, Activity } from 'lucide-react';
import { Link } from 'wouter';

export default function StudentSelection() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            StudyFlow Dashboard
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Choose your student to begin today's work
          </p>
        </div>

        {/* Student Selection Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Abigail's Card */}
          <Card className="hover:shadow-lg transition-all duration-300 border-2 hover:border-blue-300 dark:hover:border-blue-600">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-20 h-20 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-4">
                <User className="w-10 h-10 text-blue-600 dark:text-blue-400" />
              </div>
              <CardTitle className="text-2xl text-gray-900 dark:text-white">Abigail</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-6">
                <div className="flex items-center text-gray-600 dark:text-gray-300">
                  <BookOpen className="w-5 h-5 mr-3 text-blue-500" />
                  <span>Bible: Genesis 1-2</span>
                </div>
                <div className="flex items-center text-gray-600 dark:text-gray-300">
                  <Calendar className="w-5 h-5 mr-3 text-green-500" />
                  <span>9 active assignments</span>
                </div>
                <div className="flex items-center text-gray-600 dark:text-gray-300">
                  <Activity className="w-5 h-5 mr-3 text-purple-500" />
                  <span>Ready for today's schedule</span>
                </div>
              </div>
              <Link href="/student/abigail">
                <Button 
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg font-medium"
                  data-testid="button-select-abigail"
                >
                  Start Abigail's Day
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Khalil's Card */}
          <Card className="hover:shadow-lg transition-all duration-300 border-2 hover:border-green-300 dark:hover:border-green-600">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-20 h-20 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
                <User className="w-10 h-10 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle className="text-2xl text-gray-900 dark:text-white">Khalil</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-6">
                <div className="flex items-center text-gray-600 dark:text-gray-300">
                  <BookOpen className="w-5 h-5 mr-3 text-blue-500" />
                  <span>Bible: Genesis 1-2</span>
                </div>
                <div className="flex items-center text-gray-600 dark:text-gray-300">
                  <Calendar className="w-5 h-5 mr-3 text-green-500" />
                  <span>68 active assignments</span>
                </div>
                <div className="flex items-center text-gray-600 dark:text-gray-300">
                  <Activity className="w-5 h-5 mr-3 text-purple-500" />
                  <span>Ready for today's schedule</span>
                </div>
              </div>
              <Link href="/student/khalil">
                <Button 
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-3 text-lg font-medium"
                  data-testid="button-select-khalil"
                >
                  Start Khalil's Day
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Quick Access Links */}
        <div className="text-center mt-12">
          <div className="space-x-4">
            <Link href="/admin">
              <Button variant="outline" className="text-gray-600 dark:text-gray-300" data-testid="link-admin-panel">
                Admin Panel
              </Button>
            </Link>
            <Link href="/">
              <Button variant="outline" className="text-gray-600 dark:text-gray-300" data-testid="link-home">
                Home
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}