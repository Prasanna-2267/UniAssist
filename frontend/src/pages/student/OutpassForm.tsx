import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { studentApi } from "@/services/studentApi";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const outpassSchema = z.object({
  outDate: z.string().min(1, 'Out date is required'),
  outTime: z.string().min(1, 'Out time is required'),
  inDate: z.string().optional(),
  inTime: z.string().optional(),
  contactNumber: z.string().min(10, 'Valid contact number required').max(15),
  parentContact: z.string().min(10, 'Valid parent contact required').max(15),
  purpose: z.string().min(1, 'Purpose is required').max(500, 'Purpose too long'),
  isHosteler: z.boolean(),
  hostelId: z.string().optional(),
  floorId: z.string().optional(),
  roomNumber: z.string().optional(),
}).refine((data) => {
  if (data.isHosteler) {
    return data.hostelId && data.floorId && data.roomNumber;
  }
  return true;
}, {
  message: 'Hostel details are required for hostelers',
  path: ['hostelId'],
});

type OutpassFormData = z.infer<typeof outpassSchema>;

export default function OutpassForm() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<OutpassFormData>({
    resolver: zodResolver(outpassSchema),
    defaultValues: {
      outDate: '',
      outTime: '',
      inDate: '',
      inTime: '',
      contactNumber: '',
      parentContact: '',
      purpose: '',
      isHosteler:  false,
      hostelId: '',
      floorId: '',
      roomNumber: '',
    },
  });

  const isHosteler = form.watch('isHosteler');

  const onSubmit = async (data: OutpassFormData) => {
    setIsSubmitting(true);
    try {
      console.log('Outpass request:', data);
      await studentApi.createOutpassRequest({
  out_date: data.outDate,
  out_time: data.outTime,
  in_date: data.inDate || undefined,
  in_time: data.inTime || undefined,
  purpose: data.purpose,
  contact_number: data.contactNumber,
  parent_mobile: data.parentContact,
  hostel_id: data.isHosteler ? data.hostelId : undefined,
  floor_id: data.isHosteler ? data.floorId : undefined,
  room_no: data.isHosteler ? data.roomNumber : undefined,
});


      toast.success('Outpass request submitted successfully');
      navigate('/student/requests');
    } catch (error) {
      toast.error(error.message || "Failed to submit outpass request");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <PageHeader 
        title="Apply for Outpass"
        description="Request permission to leave campus"
      />

      <Card className="max-w-2xl">
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Date and Time */}
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="outDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Out Date *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="outTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Out Time *</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="inDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>In Date (Optional)</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="inTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>In Time (Optional)</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Contact Info */}
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="contactNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Number *</FormLabel>
                      <FormControl>
                        <Input type="tel" placeholder="Your contact number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="parentContact"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Parent Contact *</FormLabel>
                      <FormControl>
                        <Input type="tel" placeholder="Parent's contact number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Purpose */}
              <FormField
                control={form.control}
                name="purpose"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purpose *</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Reason for outpass request..."
                        className="min-h-[100px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Hosteler Toggle */}
              <FormField
                control={form.control}
                name="isHosteler"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Hosteler</FormLabel>
                      <FormDescription>
                        Enable if you are staying in the hostel
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Hostel Details */}
              {isHosteler && (
                <div className="grid gap-4 sm:grid-cols-3 p-4 rounded-lg bg-muted/50">
                  <FormField
                    control={form.control}
                    name="hostelId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hostel ID *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., H1" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="floorId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Floor *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., 2" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="roomNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Room Number *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., 205" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

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