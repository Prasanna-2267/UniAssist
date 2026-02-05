import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { studentApi } from '@/services/studentApi';
import { Card, CardContent } from '@/components/ui/card';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, UploadCloud, FileCheck2, X } from 'lucide-react';

function formatTimeForAPI(time?: string) {
  if (!time || time.trim() === "") return undefined;
  return time.length === 5 ? `${time}:00` : time;
}

const odSchema = z.object({
  fromDate: z.string().min(1),
  toDate: z.string().min(1),
  purpose: z.string().min(1).max(500),
  proofFile: z.instanceof(File),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  place: z.string().optional(),
}).refine((d) => new Date(d.toDate) >= new Date(d.fromDate), {
  message: "To date must be after from date",
  path: ["toDate"],
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
          place: data.place?.trim() || undefined,
        },
        data.proofFile
      );
      toast.success("OD request submitted successfully");
      navigate("/student/requests");
    } catch (e: any) {
      toast.error(e.message || "Submission failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputStyle =
    "w-full h-10 border border-input bg-background px-3 py-2 text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";

  return (
    <DashboardLayout>
      <PageHeader title="Apply for OD (On Duty)" description="Submit an on-duty request with proof" />

      <Card className="max-w-2xl">
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

              {/* Dates */}
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="fromDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>From Date *</FormLabel>
                    <FormControl>
                      <DatePicker
                        selected={field.value ? new Date(field.value) : null}
                        onChange={(d) => field.onChange(d?.toISOString().split("T")[0])}
                        dateFormat="dd-MM-yyyy"
                        wrapperClassName="w-full"
                        className={inputStyle}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="toDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>To Date *</FormLabel>
                    <FormControl>
                      <DatePicker
                        selected={field.value ? new Date(field.value) : null}
                        onChange={(d) => field.onChange(d?.toISOString().split("T")[0])}
                        dateFormat="dd-MM-yyyy"
                        wrapperClassName="w-full"
                        className={inputStyle}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* Time */}
              <div className="grid gap-4 sm:grid-cols-2">
                {["startTime", "endTime"].map((name, i) => (
                  <FormField key={name} control={form.control} name={name as any} render={({ field }) => (
                    <FormItem>
                      <FormLabel>{i === 0 ? "Start Time" : "End Time"} (Optional)</FormLabel>
                      <FormControl>
                        <DatePicker
                          selected={field.value ? new Date(`1970-01-01T${field.value}`) : null}
                          onChange={(d) => field.onChange(d?.toTimeString().slice(0, 5))}
                          showTimeSelect
                          showTimeSelectOnly
                          timeIntervals={15}
                          timeCaption="Time"
                          dateFormat="HH:mm"
                          wrapperClassName="w-full"
                          className={inputStyle}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                ))}
              </div>

              {/* Place */}
              <FormField control={form.control} name="place" render={({ field }) => (
                <FormItem>
                  <FormLabel>Place (Optional)</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                </FormItem>
              )} />

              {/* Purpose */}
              <FormField control={form.control} name="purpose" render={({ field }) => (
                <FormItem>
                  <FormLabel>Purpose *</FormLabel>
                  <FormControl><Textarea className="min-h-[100px]" {...field} /></FormControl>
                </FormItem>
              )} />

              {/* Upload */}
              <FormField control={form.control} name="proofFile" render={() => (
                <FormItem>
                  <FormLabel>Proof File (PDF) *</FormLabel>
                  <FormControl>
                    <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted"
                         onClick={() => fileInputRef.current?.click()}>
                      <input ref={fileInputRef} type="file" accept=".pdf" hidden
                             onChange={(e) => form.setValue('proofFile', e.target.files?.[0] as File)} />
                      {!selectedFile ? (
                        <>
                          <UploadCloud className="mx-auto h-10 w-10 text-muted-foreground" />
                          <p className="text-sm mt-2">Click to upload PDF</p>
                        </>
                      ) : (
                        <div className="flex justify-between items-center">
                          <FileCheck2 className="h-5 w-5 text-green-600" />
                          <span className="text-sm">{selectedFile.name}</span>
                          <X className="cursor-pointer" onClick={(e) => {
                            e.stopPropagation();
                            form.setValue('proofFile', undefined as any);
                          }} />
                        </div>
                      )}
                    </div>
                  </FormControl>
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
