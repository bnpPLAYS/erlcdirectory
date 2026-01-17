import { FileText, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Navbar from '@/components/layout/Navbar';

const Posts = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10">
            <div className="w-16 h-16 mx-auto mb-6 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
              <FileText className="h-8 w-8 text-primary-foreground" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-3">Posts & Applications</h1>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Public announcements, availability posts, and role applications
            </p>
          </div>
          
          <div className="max-w-2xl mx-auto">
            <Card className="border-dashed">
              <CardContent className="p-12 text-center">
                <FileText className="h-16 w-16 mx-auto mb-6 text-muted-foreground/50" />
                <h3 className="text-xl font-semibold mb-2">No Posts Yet</h3>
                <p className="text-muted-foreground mb-6">
                  Be the first to create a post or application listing.
                </p>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Post
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Posts;
