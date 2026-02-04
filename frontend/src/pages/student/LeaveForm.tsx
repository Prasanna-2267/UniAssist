import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import DatePicker from "react-datepicker"
import "react-datepicker/dist/react-datepicker.css"
import "@/styles/datepicker-theme.css"

import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { studentApi } from "../../services/studentApi"
import { Card, CardContent } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

const leaveSchema = z.object({
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  category: z.enum(['short', 'long', 'emergency', 'others'], {
    required_error: 'Please select a category',
  }),
  reason: z.string().optional(),
}).refine((data) => new Date(data.endDate) >= new Date(data.startDate), {
  message: 'End date must be after start date',
  path: ['endDate'],
})

type LeaveFormData = z.infer<typeof leaveSchema>

export default function LeaveForm() {
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const form = useForm<LeaveFormData>({
    resolver: zodResolver(leaveSchema),
    defaultValues: {
      startDate: '',
      endDate: '',
      category: undefined,
      reason: '',
    },
  })

  const onSubmit = async (data: LeaveFormData) => {
    setIsSubmitting(true)
    try {
      const payload = {
        category: data.category.toUpperCase(),
        start_date: data.startDate,
        end_date: data.endDate,
        reason: data.reason || "",
      }

      await studentApi.createLeaveRequest(payload)

      toast.success("Leave request submitted successfully")
      navigate("/student/requests")

    } catch (error: any) {
      const msg =
        error?.response?.data?.detail ||
        error?.message ||
        "Failed to submit leave request"
      toast.error(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <DashboardLayout>
      <PageHeader 
        title="Apply for Leave"
        description="Submit a new leave request"
      />

      <Card className="max-w-2xl">
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

              {/* 📅 DATE PICKERS */}
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date *</FormLabel>
                      <FormControl>
                        <DatePicker
                          selected={field.value ? new Date(field.value) : null}
                          onChange={(date: Date | null) =>
                            field.onChange(date ? date.toISOString().split('T')[0] : '')
                          }
                          dateFormat="dd-MM-yyyy"
                          minDate={new Date()}
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
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date *</FormLabel>
                      <FormControl>
                        <DatePicker
                          selected={field.value ? new Date(field.value) : null}
                          onChange={(date: Date | null) =>
                            field.onChange(date ? date.toISOString().split('T')[0] : '')
                          }
                          dateFormat="dd-MM-yyyy"
                          minDate={form.watch("startDate") ? new Date(form.watch("startDate")) : new Date()}
                          placeholderText="Select end date"
                          className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* CATEGORY */}
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select leave category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="short">Short Leave</SelectItem>
                        <SelectItem value="long">Long Leave</SelectItem>
                        <SelectItem value="emergency">Emergency Leave</SelectItem>
                        <SelectItem value="others">Others</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* REASON */}
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Provide additional details for your leave request..."
                        className="min-h-[100px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* BUTTONS */}
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
  )
}
