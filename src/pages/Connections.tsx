import { Users, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import Navbar from '@/components/layout/Navbar';

const Connections = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10">
            <div className="w-16 h-16 mx-auto mb-6 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
              <Users className="h-8 w-8 text-primary-foreground" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-3">Connections</h1>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Connect and message other professionals
            </p>
          </div>
          
          <div className="max-w-2xl mx-auto">
            <Card className="border-dashed">
              <CardContent className="p-12 text-center">
                <MessageSquare className="h-16 w-16 mx-auto mb-6 text-muted-foreground/50" />
                <h3 className="text-xl font-semibold mb-2">Sign In to Connect</h3>
                <p className="text-muted-foreground mb-6">
                  Create an account to start connecting with other professionals.
                </p>
                <Link to="/auth">
                  <Button className="gap-2">
                    <Users className="h-4 w-4" />
                    Sign In
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Connections;
