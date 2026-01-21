"use client";

import * as React from "react";
import {
  Clock,
  User,
  Calendar as CalendarIcon,
  CheckCircle,
  Pencil,
  Tag,
  Megaphone,
  AlertCircle,
} from "lucide-react";
import { format, isBefore, startOfDay, parse } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";

import { databases, ID } from "@/lib/appwrite";
import { Query } from "appwrite";

const DB = process.env.NEXT_PUBLIC_DATABASE_ID!;
const BOOKINGS = "appointments";
const SCHEDULES = "clinic_schedules"; // The new collection you created

export default function PublicAppointmentForm() {
  const [bookedSlots, setBookedSlots] = React.useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [now, setNow] = React.useState(new Date());

  // State for dynamic operating hours
  const [operatingHours, setOperatingHours] = React.useState<{
    open: string;
    close: string;
    active: boolean;
    name?: string; // To show "Summer Hours" etc.
  } | null>(null);

  const [isLoadingHours, setIsLoadingHours] = React.useState(false);

  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(
    new Date(),
  );
  const [selectedTime, setSelectedTime] = React.useState<string | undefined>();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [note, setNote] = React.useState("");
  const [referralSource, setReferralSource] = React.useState("");
  const [tags, setTags] = React.useState("");

  React.useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 1. Fetch Operating Hours Logic
  const fetchOperatingHours = React.useCallback(async (date: Date) => {
    setIsLoadingHours(true);
    try {
      // Fetch all schedules sorted by priority (High priority overrides low)
      const res = await databases.listDocuments(DB, SCHEDULES, [
        Query.orderDesc("priority"),
      ]);

      const targetTime = date.getTime();

      // Find the first schedule that covers this date
      const activeSchedule = res.documents.find((sch) => {
        const start = new Date(sch.startDate).getTime();
        const end = new Date(sch.endDate).getTime();
        // Reset time parts for accurate date comparison if needed,
        // but typically ISO strings work if generated correctly.
        return targetTime >= start && targetTime <= end;
      });

      if (!activeSchedule) {
        // Fallback if no schedule covers this date (assume closed or default)
        setOperatingHours({
          open: "00:00",
          close: "00:00",
          active: false,
          name: "No Schedule Found",
        });
        return;
      }

      const config = JSON.parse(activeSchedule.config);
      const dayName = format(date, "EEEE"); // "Monday", "Tuesday"...
      const daySettings = config[dayName];

      setOperatingHours({
        ...daySettings,
        name: activeSchedule.name, // Pass the schedule name to UI (e.g. "Holiday Hours")
      });
    } catch (err) {
      console.error("Error fetching hours:", err);
      // Fallback safe mode
      setOperatingHours({
        open: "09:00",
        close: "17:00",
        active: true,
        name: "System Default",
      });
    } finally {
      setIsLoadingHours(false);
    }
  }, []);

  // 2. Load Bookings
  const loadBookedSlots = React.useCallback(async (date: Date) => {
    const key = format(date, "yyyy-MM-dd");
    try {
      const res = await databases.listDocuments(DB, BOOKINGS, [
        Query.equal("dateKey", key),
        Query.notEqual("status", "cancelled"),
      ]);
      setBookedSlots(res.documents);
    } catch (err) {
      console.error(err);
    }
  }, []);

  // Trigger both fetches when date changes
  React.useEffect(() => {
    if (selectedDate) {
      loadBookedSlots(selectedDate);
      fetchOperatingHours(selectedDate);
    }
    setSelectedTime(undefined);
  }, [selectedDate, loadBookedSlots, fetchOperatingHours]);

  // 3. Generate Slots based on Dynamic Hours
  const slots = React.useMemo(() => {
    if (!selectedDate || !operatingHours || !operatingHours.active) return [];

    const { open, close } = operatingHours;
    const generated = [];

    // Parse start and end times (e.g., "09:00" -> Date object)
    const startDate = parse(open, "HH:mm", selectedDate);
    const endDate = parse(close, "HH:mm", selectedDate);

    // Convert to minutes for the loop
    let currentMinutes = startDate.getHours() * 60 + startDate.getMinutes();
    const endMinutes = endDate.getHours() * 60 + endDate.getMinutes();

    // Loop in 30 min intervals
    while (currentMinutes < endMinutes) {
      const h = Math.floor(currentMinutes / 60);
      const m = currentMinutes % 60;

      // Format 12-hour string (e.g. "09:00 AM")
      const timeString = format(new Date(2000, 0, 1, h, m), "hh:mm a");
      generated.push(timeString);

      currentMinutes += 30;
    }

    const booked = bookedSlots.map((b) => b.time);
    return generated.filter((t) => !booked.includes(t));
  }, [selectedDate, bookedSlots, operatingHours]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDate || !selectedTime || isSubmitting) return;
    setIsSubmitting(true);

    try {
      await databases.createDocument(DB, BOOKINGS, ID.unique(), {
        title: name,
        email: email,
        phone: phone,
        notes: note,
        referralSource: referralSource,
        tags: tags,
        date: selectedDate.toISOString(),
        dateKey: format(selectedDate, "yyyy-MM-dd"),
        time: selectedTime,
        status: "pending",
        timestamp: String(Math.floor(Date.now() / 1000)),
      });
      setSuccess(true);
    } catch (err) {
      console.error("Submission error:", err);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (success)
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
        <Card className="max-w-md w-full bg-white border-emerald-500 border-t-4 p-8 text-center space-y-6 shadow-xl">
          <div className="h-20 w-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="h-12 w-12 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-zinc-800">Request Sent!</h2>
          <p className="text-zinc-500">
            Thank you {name}. We will review your request and contact you
            shortly.
          </p>
          <Button
            onClick={() => window.location.reload()}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            Make Another Booking
          </Button>
        </Card>
      </div>
    );

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 flex flex-col xl:flex-row font-sans">
      <main className="flex-1 p-4 lg:p-10 overflow-y-auto">
        <div className="max-w-7xl mx-auto space-y-8">
          <header className="flex items-center gap-4 bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
            <div className="bg-emerald-50 p-2 rounded-lg">
              <img
                src="/alipio-dental-logo.png"
                alt="Logo"
                className="h-10 w-auto"
              />
            </div>
            <div>
              <h1 className="text-xl font-bold text-zinc-800">
                Book an Appointment
              </h1>
              <p className="text-xs text-emerald-600 font-medium italic">
                Alipio Dental Clinic • Since 1989
              </p>
            </div>
          </header>

          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8"
          >
            <div className="lg:col-span-5 space-y-6">
              <Card className="bg-white border-zinc-200 p-5 shadow-sm">
                <Label className="text-emerald-700 font-bold flex items-center gap-2 mb-4">
                  <CalendarIcon className="h-4 w-4" /> 1. Select Date
                </Label>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={
                    (date) => isBefore(date, startOfDay(new Date()))
                    // Removed fixed Sunday check since schedules now handle closed days
                  }
                  className="rounded-md border-zinc-100 w-full"
                />
              </Card>

              <Card className="bg-white border-zinc-200 p-5 shadow-sm min-h-50">
                <div className="flex justify-between items-center mb-4">
                  <Label className="text-emerald-700 font-bold flex items-center gap-2">
                    <Clock className="h-4 w-4" /> 2. Available Slots
                  </Label>
                  {/* Badge showing which schedule is active */}
                  {operatingHours?.name && (
                    <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded-full font-bold border border-blue-100">
                      {operatingHours.name}
                    </span>
                  )}
                </div>

                {isLoadingHours ? (
                  <div className="flex flex-col items-center justify-center h-40 text-zinc-400 gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-600"></div>
                    <span className="text-xs">Checking availability...</span>
                  </div>
                ) : !operatingHours?.active ? (
                  // CLOSED STATE
                  <div className="flex flex-col items-center justify-center h-40 bg-red-50 rounded-xl border border-red-100 text-red-500 gap-2">
                    <AlertCircle className="h-8 w-8" />
                    <span className="font-bold">Clinic Closed</span>
                    <span className="text-xs">
                      No appointments on this date.
                    </span>
                  </div>
                ) : (
                  // OPEN STATE
                  <div className="grid grid-cols-3 gap-2">
                    {slots.length > 0 ? (
                      slots.map((t) => (
                        <Button
                          key={t}
                          type="button"
                          variant={selectedTime === t ? "default" : "outline"}
                          onClick={() => setSelectedTime(t)}
                          className={`text-[10px] h-9 transition-colors ${
                            selectedTime === t
                              ? "bg-emerald-600 text-white hover:bg-emerald-700"
                              : "border-zinc-200 text-zinc-600 hover:bg-emerald-50"
                          }`}
                        >
                          {t}
                        </Button>
                      ))
                    ) : (
                      <div className="col-span-3 text-center py-8 text-zinc-400 text-sm">
                        fully booked
                      </div>
                    )}
                  </div>
                )}
              </Card>
            </div>

            <div className="lg:col-span-7 space-y-6">
              <Card className="bg-white border-zinc-200 p-6 shadow-sm">
                <h3 className="text-emerald-700 font-bold flex items-center gap-2 mb-6">
                  <User className="h-4 w-4" /> 3. Patient Information
                </h3>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-zinc-500 text-xs">Full Name *</Label>
                    <Input
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="border-zinc-200 focus:border-emerald-500 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-zinc-500 text-xs">Mobile *</Label>
                      <Input
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="border-zinc-200"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-zinc-500 text-xs">Email *</Label>
                      <Input
                        required
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="border-zinc-200"
                      />
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="bg-white border-zinc-200 p-6 shadow-sm">
                <h3 className="text-emerald-700 font-bold flex items-center gap-2 mb-6">
                  <Pencil className="h-4 w-4" /> 4. Additional Details
                </h3>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-zinc-500 text-xs">
                      Reason for Visit
                    </Label>
                    <Textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className="border-zinc-200"
                      placeholder="Cleaning, Extraction, etc."
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-zinc-500 text-xs flex items-center gap-1">
                        <Tag className="h-3 w-3" /> Tags
                      </Label>
                      <Input
                        value={tags}
                        onChange={(e) => setTags(e.target.value)}
                        className="border-zinc-200"
                        placeholder="Urgent..."
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-zinc-500 text-xs flex items-center gap-1">
                        <Megaphone className="h-3 w-3" /> Referral
                      </Label>
                      <Select
                        value={referralSource}
                        onValueChange={setReferralSource}
                      >
                        <SelectTrigger className="border-zinc-200">
                          <SelectValue placeholder="Source?" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="facebook">Facebook</SelectItem>
                          <SelectItem value="google">Google</SelectItem>
                          <SelectItem value="referral">
                            Friend/Relative
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </Card>

              <Button
                type="submit"
                disabled={isSubmitting || !selectedTime}
                className="w-full py-7 text-lg font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
              >
                {isSubmitting ? "Confirming..." : "Book Appointment"}
              </Button>
            </div>
          </form>
        </div>
      </main>

      <aside className="hidden xl:flex w-80 bg-white border-l border-zinc-200 flex-col p-6 sticky top-0 h-screen shadow-sm overflow-y-auto">
        <div className="space-y-6">
          {/* Live Clock Card */}
          <div className="bg-emerald-600 p-6 rounded-2xl text-center text-white shadow-emerald-200 shadow-xl">
            <p className="text-emerald-100 text-[10px] font-bold uppercase tracking-widest mb-1">
              Clinic Time
            </p>
            <h2 className="text-3xl font-mono font-bold">
              {format(now, "HH:mm:ss")}
            </h2>
            <p className="text-emerald-100 text-xs mt-1">
              {format(now, "EEEE, MMM d")}
            </p>
          </div>

          {/* Facebook Marketing Card */}
          <a
            href="https://www.facebook.com/Alipio.Dental.Org001?rdid=EVbivnMJI2YxZQYk&share_url=https%3A%2F%2Fwww.facebook.com%2Fshare%2F1DGUVps16U%2F#"
            target="_blank"
            rel="noopener noreferrer"
            className="group block p-4 rounded-2xl border border-blue-100 bg-blue-50/50 hover:bg-blue-50 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg text-white group-hover:scale-110 transition-transform">
                <svg
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                >
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.954 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-bold text-blue-900">
                  Follow us on Facebook
                </h4>
                <p className="text-[11px] text-blue-700">
                  See our latest transformations & tips
                </p>
              </div>
            </div>
          </a>

          {/* Summary Section */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
              Your Selection
            </h4>
            {selectedTime ? (
              <div className="space-y-3">
                {/* Appointment Slot */}
                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                  <p className="text-[10px] text-emerald-600 uppercase font-bold">
                    Schedule
                  </p>
                  <p className="text-sm font-semibold text-zinc-800">
                    {format(selectedDate!, "MMMM d, yyyy")}
                  </p>
                  <p className="text-xl font-bold text-emerald-600">
                    {selectedTime}
                  </p>
                  {/* Dynamic Schedule Name in Summary */}
                  {operatingHours?.name && (
                    <p className="text-[10px] text-zinc-500 mt-1 flex items-center gap-1">
                      <Tag className="h-3 w-3" /> {operatingHours.name}
                    </p>
                  )}
                </div>

                {/* Patient Details Preview */}
                <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100 space-y-3">
                  <div>
                    <p className="text-[10px] text-zinc-400 uppercase font-bold">
                      Patient
                    </p>
                    <p className="text-sm font-medium text-zinc-700 truncate">
                      {name || (
                        <span className="text-zinc-300 italic">
                          Enter name...
                        </span>
                      )}
                    </p>
                  </div>

                  {phone && (
                    <div>
                      <p className="text-[10px] text-zinc-400 uppercase font-bold">
                        Contact
                      </p>
                      <p className="text-sm font-medium text-zinc-700">
                        {phone}
                      </p>
                    </div>
                  )}

                  {email && (
                    <div>
                      <p className="text-[10px] text-zinc-400 uppercase font-bold">
                        Email
                      </p>
                      <p className="text-sm font-medium text-zinc-700">
                        {email}
                      </p>
                    </div>
                  )}

                  {note && (
                    <div className="pt-2 border-t border-zinc-200/60">
                      <p className="text-[10px] text-zinc-400 uppercase font-bold">
                        Reason
                      </p>
                      <p className="text-xs text-zinc-600 line-clamp-2 italic">
                        "{note}"
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-6 border-2 border-dashed border-zinc-100 rounded-2xl text-center text-zinc-300">
                <Clock className="h-6 w-6 mx-auto mb-2 opacity-20" />
                <p className="text-xs">Pick a time to see summary</p>
              </div>
            )}
          </div>
          {/* Why Choose Us / Trust Signals */}
          <div className="pt-4 space-y-3">
            <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
              Why Alipio Dental?
            </h4>

            <div className="flex gap-3 items-start">
              <div className="bg-emerald-100 p-1.5 rounded-full text-emerald-600 mt-1">
                <CheckCircle className="h-3 w-3" />
              </div>
              <p className="text-xs text-zinc-600">
                <strong>Expert Care:</strong> Serving smiles since 1989 with
                over 30 years of experience.
              </p>
            </div>

            <div className="flex gap-3 items-start">
              <div className="bg-emerald-100 p-1.5 rounded-full text-emerald-600 mt-1">
                <CheckCircle className="h-3 w-3" />
              </div>
              <p className="text-xs text-zinc-600">
                <strong>Modern Tech:</strong> Equipped with the latest dental
                technology for painless visits.
              </p>
            </div>

            <div className="flex gap-3 items-start">
              <div className="bg-emerald-100 p-1.5 rounded-full text-emerald-600 mt-1">
                <CheckCircle className="h-3 w-3" />
              </div>
              <p className="text-xs text-zinc-600">
                <strong>Safety First:</strong> Strict sterilization protocols
                following international standards.
              </p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
