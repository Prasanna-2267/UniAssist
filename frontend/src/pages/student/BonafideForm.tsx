import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { studentApi } from '@/services/studentApi';
import { useAuth } from '@/contexts/AuthContext';
import DatePicker from "react-datepicker"
import "react-datepicker/dist/react-datepicker.css"
import "@/styles/datepicker-theme.css"


const bonafideSchema = z.object({
  category: z.enum(['INTERNSHIP', 'GENERAL', 'EDUCATIONAL_LOAN', 'SCHOLARSHIP'], {
    required_error: 'Please select a category',
  }),
  purpose: z.string().optional(),
  internshipStartDate: z.string().optional(),
  internshipEndDate: z.string().optional(),
}).refine((data) => {
  if (data.category === 'INTERNSHIP') {
    return data.internshipStartDate && data.internshipEndDate;
  }
  return true;
}, {
  message: 'Internship dates are required for internship bonafide',
  path: ['internshipStartDate'],
}).refine((data) => {
  if (data.category === 'INTERNSHIP' && data.internshipStartDate && data.internshipEndDate) {
    return new Date(data.internshipEndDate) >= new Date(data.internshipStartDate);
  }
  return true;
}, {
  message: 'End date must be after start date',
  path: ['internshipEndDate'],
});

type BonafideFormData = z.infer<typeof bonafideSchema>;

export default function BonafideForm() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<BonafideFormData>({
    resolver: zodResolver(bonafideSchema),
    defaultValues: {
      category: undefined,
      purpose: '',
      internshipStartDate: '',
      internshipEndDate: '',
    },
  });

  const selectedCategory = form.watch('category');

  const onSubmit = async (data: BonafideFormData) => {
    setIsSubmitting(true);
    try {
      await studentApi.createBonafideRequest({
        reg_no: user.reg_no,
        category: data.category,
        purpose: data.purpose,
        intern_start_date: data.internshipStartDate || undefined,
        intern_end_date: data.internshipEndDate || undefined,
      });

      toast.success('Bonafide request submitted successfully');
      navigate('/student/requests');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to submit bonafide request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <PageHeader 
        title="Apply for Bonafide"
        description="Request a bonafide certificate"
      />

      <Card className="max-w-2xl">
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select bonafide type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="INTERNSHIP">Internship Bonafide</SelectItem>
                        <SelectItem value="GENERAL">General Bonafide</SelectItem>
                        <SelectItem value="EDUCATIONAL_LOAN">Educational Loan Bonafide</SelectItem>
                        <SelectItem value="SCHOLARSHIP">Scholarship Bonafide</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {selectedCategory === 'INTERNSHIP' && (
  <div className="grid gap-4 sm:grid-cols-2 p-4 rounded-lg bg-muted/50">
    <FormField
      control={form.control}
      name="internshipStartDate"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Internship Start Date *</FormLabel>
          <FormControl>
            <DatePicker
              selected={field.value ? new Date(field.value) : null}
              onChange={(date: Date | null) =>
                field.onChange(date ? date.toISOString().split('T')[0] : '')
              }
              dateFormat="dd-MM-yyyy"
              placeholderText="Select start date"
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />

    <FormField
      control={form.control}
      name="internshipEndDate"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Internship End Date *</FormLabel>
          <FormControl>
            <DatePicker
              selected={field.value ? new Date(field.value) : null}
              onChange={(date: Date | null) =>
                field.onChange(date ? date.toISOString().split('T')[0] : '')
              }
              dateFormat="dd-MM-yyyy"
              minDate={
                form.watch("internshipStartDate")
                  ? new Date(form.watch("internshipStartDate"))
                  : new Date()
              }
              placeholderText="Select end date"
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  </div>
)}


              <FormField
                control={form.control}
                name="purpose"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purpose (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Describe the purpose of your bonafide request..."
                        className="min-h-[100px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-3">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Submit Request
                </Button>
                <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
