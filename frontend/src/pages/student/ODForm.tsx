import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { studentApi } from '@/services/studentApi';
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
import { toast } from 'sonner';
import { Loader2, Upload, FileText, X } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

function formatTimeForAPI(time?: string) {
  if (!time || time.trim() === "") return undefined;
  return time.length === 5 ? `${time}:00` : time;
}

const odSchema = z.object({
  fromDate: z.string().min(1, 'From date is required'),
  toDate: z.string().min(1, 'To date is required'),
  purpose: z.string().min(1, 'Purpose is required').max(500),
  proofFile: z.instanceof(File, { message: 'Proof file (PDF) is required' })
    .refine((file) => file.type === 'application/pdf', 'Only PDF files are allowed')
    .refine((file) => file.size <= 5 * 1024 * 1024, 'File size must be less than 5MB'),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  place: z.string().optional(),
}).refine((data) => new Date(data.toDate) >= new Date(data.fromDate), {
  message: 'To date must be after from date',
  path: ['toDate'],
});

type ODFormData = z.infer<typeof odSchema>;

export default function ODForm() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const form = useForm<ODFormData>({
    resolver: zodResolver(odSchema),
    defaultValues: {
      fromDate: '',
      toDate: '',
      purpose: '',
      proofFile: undefined,
      startTime: '',
      endTime: '',
      place: '',
    },
  });

  const selectedFile = form.watch('proofFile');

  const onSubmit = async (data: ODFormData) => {
  setIsSubmitting(true);

  try {
    await studentApi.createODRequest(
      {
        fromDate: data.fromDate,
        toDate: data.toDate,
        startTime: formatTimeForAPI(data.startTime),
        endTime: formatTimeForAPI(data.endTime),
        purpose: data.purpose,
        place: data.place?.trim() ? data.place : undefined,
      },
      data.proofFile
    );

    toast.success("OD request submitted successfully");
    navigate("/student/requests");

  } catch (error: any) {
    toast.error(error.message || "Submission failed");
  } finally {
    setIsSubmitting(false);
  }
};


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      form.setValue('proofFile', file, { shouldValidate: true });
    }
  };

  const removeFile = () => {
    form.setValue('proofFile', undefined as unknown as File, { shouldValidate: true });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <DashboardLayout>
      <PageHeader title="Apply for OD (On Duty)" description="Submit an on-duty request with proof" />

      <Card className="max-w-2xl">
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="fromDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>From Date *</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="toDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>To Date *</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="startTime" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Time (Optional)</FormLabel>
                    <FormControl><Input type="time" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="endTime" render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Time (Optional)</FormLabel>
                    <FormControl><Input type="time" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="place" render={({ field }) => (
                <FormItem>
                  <FormLabel>Place (Optional)</FormLabel>
                  <FormControl><Input placeholder="Location of the event/activity" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="purpose" render={({ field }) => (
                <FormItem>
                  <FormLabel>Purpose *</FormLabel>
                  <FormControl><Textarea className="min-h-[100px]" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="proofFile" render={() => (
                <FormItem>
                  <FormLabel>Proof File (PDF) *</FormLabel>
                  <FormControl>
                    <div className="space-y-2">
                      <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileChange} className="hidden" />
                      {!selectedFile ? (
                        <div onClick={() => fileInputRef.current?.click()} className="upload-box">
                          <Upload className="h-8 w-8 mb-2" />
                          <p>Click to upload PDF</p>
                        </div>
                      ) : (
                        <div className="file-preview">
                          <FileText className="h-5 w-5" />
                          <span>{selectedFile.name}</span>
                          <Button type="button" onClick={removeFile}><X /></Button>
                        </div>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="flex gap-3">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Submit Request
                </Button>
                <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
              </div>

            </form>
          </Form>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
