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
} from "lucide-react";
import { format, isBefore, startOfDay } from "date-fns";
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

export default function PublicAppointmentForm() {
  const [bookedSlots, setBookedSlots] = React.useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [now, setNow] = React.useState(new Date());

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

  React.useEffect(() => {
    if (selectedDate) loadBookedSlots(selectedDate);
    setSelectedTime(undefined);
  }, [selectedDate, loadBookedSlots]);

  const slots = React.useMemo(() => {
    if (!selectedDate) return [];
    const generated = [];
    for (let t = 540; t < 1020; t += 30) {
      const h = Math.floor(t / 60),
        m = t % 60;
      generated.push(format(new Date(2000, 0, 1, h, m), "hh:mm a"));
    }
    const booked = bookedSlots.map((b) => b.time);
    return generated.filter((t) => !booked.includes(t));
  }, [selectedDate, bookedSlots]);

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
        // FIX: Convert the number to a string to match Appwrite schema
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
                  disabled={(date) =>
                    isBefore(date, startOfDay(new Date())) ||
                    date.getDay() === 0
                  }
                  className="rounded-md border-zinc-100 w-full"
                />
              </Card>

              <Card className="bg-white border-zinc-200 p-5 shadow-sm">
                <Label className="text-emerald-700 font-bold flex items-center gap-2 mb-4">
                  <Clock className="h-4 w-4" /> 2. Available Slots
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  {slots.map((t) => (
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
                  ))}
                </div>
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
                className="w-full py-7 text-lg font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200 transition-all active:scale-95"
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
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
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
