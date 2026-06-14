"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/lib/supabase";
import imageCompression from 'browser-image-compression';
import { UploadCloud, Search, Loader2, Image as ImageIcon, MapPin, User, Hash, Zap, FileText, LayoutList, PlusCircle, Maximize2, X, Calendar, ArrowRight } from "lucide-react";

const logSchema = z.object({
  consumer_name: z.string().min(1, "Consumer name is required"),
  address: z.string().min(1, "Address is required"),
  meter_number: z.string().regex(/^[a-zA-Z0-9]+$/, "Meter number must be alphanumeric"),
  kwh: z.number().positive("kWh must be positive"),
  kvah: z.number().positive("kVAh must be positive"),
  md: z.number().positive("MD must be positive"),
  location: z.string().min(1, "Location is required"),
  reason: z.enum(["burnt", "fully burnt", "defective"], { message: "Please select a reason" }),
  notes: z.string().optional(),
});

type LogFormData = z.infer<typeof logSchema>;

type LogRecord = {
  id: string;
  consumer_name: string;
  address: string;
  meter_number: string;
  meter_reading: number;
  kwh: number | null;
  kvah: number | null;
  md: number | null;
  location: string | null;
  reason: string | null;
  image_url: string | null;
  notes: string | null;
  created_at: string;
};

export default function VoltTrackDashboard() {
  const [logs, setLogs] = useState<LogRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<"entry" | "search">("entry");
  const [detectingLocation, setDetectingLocation] = useState(false);
  
  // Modals state
  const [selectedLog, setSelectedLog] = useState<LogRecord | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LogFormData>({
    resolver: zodResolver(logSchema),
  });

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setValue("location", `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`, {
          shouldValidate: true,
        });
        setDetectingLocation(false);
      },
      (error) => {
        console.error("Error detecting location:", error);
        let msg = "Failed to detect location.";
        if (error.code === error.PERMISSION_DENIED) {
          msg = "Location permission denied. Please allow location access in your browser settings or enter coordinates manually.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          msg = "Location information is currently unavailable. Please enter coordinates manually.";
        } else if (error.code === error.TIMEOUT) {
          msg = "Location request timed out. Please try again or enter coordinates manually.";
        } else {
          msg += ` (${error.message})`;
        }
        alert(msg);
        setDetectingLocation(false);
      }
    );
  };

  const fetchLogs = async () => {
    const { data, error } = await supabase
      .from("meter_logs")
      .select("*")
      .order("created_at", { ascending: false });
      
    if (error) {
      console.error("Error fetching logs:", error.message || JSON.stringify(error));
    } else if (data) {
      setLogs(data);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLogs();
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const onSubmit = async (data: LogFormData) => {
    try {
      let image_url = null;
      if (imageFile) {
        setIsUploading(true);
        
        const options = {
          maxSizeMB: 0.5,
          maxWidthOrHeight: 1280,
          useWebWorker: true,
        };
        
        const compressedFile = await imageCompression(imageFile, options);

        // eslint-disable-next-line react-hooks/purity
        const randomSuffix = Math.random().toString(36).substring(7);
        // Clean filename to prevent upload issues
        const cleanName = imageFile.name.replace(/[^a-zA-Z0-9.-]/g, '');
        // eslint-disable-next-line react-hooks/purity
        const fileName = `${Date.now()}-${randomSuffix}-${cleanName}`;
        
        const { error: uploadError } = await supabase.storage
          .from("meter-images")
          .upload(fileName, compressedFile);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from("meter-images")
          .getPublicUrl(fileName);
          
        image_url = publicUrlData.publicUrl;
        setIsUploading(false);
      }

      const { error: insertError } = await supabase.from("meter_logs").insert([
        {
          consumer_name: data.consumer_name,
          address: data.address,
          meter_number: data.meter_number,
          meter_reading: data.kwh,
          kwh: data.kwh,
          kvah: data.kvah,
          md: data.md,
          location: data.location,
          reason: data.reason,
          image_url,
          notes: data.notes,
        },
      ]);

      if (insertError) throw insertError;

      reset();
      setImageFile(null);
      setImagePreview(null);
      await fetchLogs(); // Refresh list
      setActiveTab("search"); // Switch to search view so they can see the log
    } catch (error) {
      console.error("Submission failed", error);
      const errorMsg = error && typeof error === 'object' && 'message' in error 
        ? (error as { message: string }).message 
        : JSON.stringify(error);
      alert(`Submission failed: ${errorMsg}\n\nNote: If you get a column error, please ensure you have run the schema_update.sql script in your Supabase SQL Editor.`);
      setIsUploading(false);
    }
  };

  const filteredLogs = useMemo(() => {
    if (!searchQuery) return logs;
    const query = searchQuery.toLowerCase();
    return logs.filter(
      (log) =>
        log.consumer_name?.toLowerCase().includes(query) ||
        log.address?.toLowerCase().includes(query) ||
        log.meter_number.toLowerCase().includes(query)
    );
  }, [logs, searchQuery]);

  return (
    <div className="min-h-[100dvh] bg-background text-foreground font-sans flex flex-col items-center py-6 px-4 sm:py-12 md:py-16 sm:px-6 lg:px-8">
      
      {/* Header Container */}
      <div className="w-full max-w-4xl mb-8 sm:mb-12 flex flex-col sm:flex-row sm:items-end justify-between gap-5 sm:gap-6">
        <div>
          <h1 className="text-2xl sm:text-4xl font-display text-foreground tracking-tight">VoltTrack</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1 font-medium">Power Supply Field Manager</p>
        </div>

        {/* Segmented Control Tab Navigation */}
        <div className="flex bg-muted p-1 rounded-2xl shadow-inner border border-border/60 relative self-start sm:self-auto w-full sm:w-auto">
          <button
            onClick={() => setActiveTab("entry")}
            className={`relative flex-1 sm:flex-none flex justify-center items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-colors z-10 ${
              activeTab === "entry" ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <PlusCircle size={16} className={activeTab === "entry" ? "text-primary" : ""} />
            <span>New Log</span>
            {activeTab === "entry" && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-card rounded-xl shadow-sm border border-border/50"
                style={{ zIndex: -1 }}
                transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
              />
            )}
          </button>
          
          <button
            onClick={() => setActiveTab("search")}
            className={`relative flex-1 sm:flex-none flex justify-center items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-colors z-10 ${
              activeTab === "search" ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutList size={16} className={activeTab === "search" ? "text-primary" : ""} />
            <span>Database</span>
            {activeTab === "search" && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-card rounded-xl shadow-sm border border-border/50"
                style={{ zIndex: -1 }}
                transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
              />
            )}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="w-full max-w-4xl relative">
        <AnimatePresence mode="wait">
          
          {activeTab === "entry" && (
            <motion.div
              key="entry"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <form onSubmit={handleSubmit(onSubmit)} className="glass-panel p-6 sm:p-10 md:p-12 rounded-2xl sm:rounded-[2rem] border-border/80">
                <div className="space-y-8 sm:space-y-10">
                  {/* Row 1 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-10">
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                        <User size={13} /> Consumer Name
                      </label>
                      <input
                        {...register("consumer_name")}
                        className="w-full bg-input border border-border/50 rounded-xl px-5 py-3.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:bg-card transition-all placeholder:text-muted-foreground/50"
                        placeholder="e.g. John Doe"
                      />
                      {errors.consumer_name && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.consumer_name.message}</p>}
                    </div>

                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                        <Hash size={13} /> Meter Number
                      </label>
                      <input
                        {...register("meter_number")}
                        className="w-full bg-input border border-border/50 rounded-xl px-5 py-3.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:bg-card transition-all placeholder:text-muted-foreground/50 uppercase"
                        placeholder="e.g. MT12345"
                      />
                      {errors.meter_number && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.meter_number.message}</p>}
                    </div>
                  </div>

                  {/* Row 2 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-10">
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                        <MapPin size={13} /> Address
                      </label>
                      <textarea
                        {...register("address")}
                        className="w-full bg-input border border-border/50 rounded-xl px-5 py-3.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:bg-card transition-all resize-none h-[140px] placeholder:text-muted-foreground/50"
                        placeholder="e.g. 123 Energy Ave, City, ST"
                      />
                      {errors.address && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.address.message}</p>}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                          <Zap size={13} /> kWh Reading
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          {...register("kwh", { valueAsNumber: true })}
                          className="w-full bg-input border border-border/50 rounded-xl px-4 py-3.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:bg-card transition-all placeholder:text-muted-foreground/50"
                          placeholder="0.00"
                        />
                        {errors.kwh && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.kwh.message}</p>}
                      </div>

                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                          <Zap size={13} /> kVAh Reading
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          {...register("kvah", { valueAsNumber: true })}
                          className="w-full bg-input border border-border/50 rounded-xl px-4 py-3.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:bg-card transition-all placeholder:text-muted-foreground/50"
                          placeholder="0.00"
                        />
                        {errors.kvah && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.kvah.message}</p>}
                      </div>
                    </div>
                  </div>

                  {/* Row 3 - MD and Location */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-10">
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                        <Zap size={13} /> Max Demand (MD)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        {...register("md", { valueAsNumber: true })}
                        className="w-full bg-input border border-border/50 rounded-xl px-5 py-3.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:bg-card transition-all placeholder:text-muted-foreground/50"
                        placeholder="0.00"
                      />
                      {errors.md && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.md.message}</p>}
                    </div>

                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center justify-between">
                        <span className="flex items-center gap-1.5"><MapPin size={13} /> Location Coordinates</span>
                        <button
                          type="button"
                          disabled={detectingLocation}
                          onClick={handleDetectLocation}
                          className="text-[10px] text-primary hover:text-accent font-bold uppercase tracking-wider flex items-center gap-1 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          {detectingLocation ? (
                            <>
                              <Loader2 className="animate-spin" size={10} /> Detecting...
                            </>
                          ) : (
                            "Auto Detect"
                          )}
                        </button>
                      </label>
                      <input
                        {...register("location")}
                        className="w-full bg-input border border-border/50 rounded-xl px-5 py-3.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:bg-card transition-all placeholder:text-muted-foreground/50"
                        placeholder="e.g. 28.6139, 77.2090 or Auto Detect"
                      />
                      {errors.location && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.location.message}</p>}
                    </div>
                  </div>

                  {/* Row 4 - Reason and Notes */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-10">
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                        <FileText size={13} /> Reason
                      </label>
                      <select
                        {...register("reason")}
                        className="w-full bg-input border border-border/50 rounded-xl px-5 py-3.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:bg-card transition-all"
                      >
                        <option value="">Select Reason...</option>
                        <option value="burnt">Burnt</option>
                        <option value="fully burnt">Fully Burnt</option>
                        <option value="defective">Defective</option>
                      </select>
                      {errors.reason && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.reason.message}</p>}
                    </div>

                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                        <FileText size={13} /> Notes <span className="lowercase font-normal text-muted-foreground/60">(optional)</span>
                      </label>
                      <input
                        {...register("notes")}
                        className="w-full bg-input border border-border/50 rounded-xl px-5 py-3.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:bg-card transition-all placeholder:text-muted-foreground/50"
                        placeholder="Any observations..."
                      />
                    </div>
                  </div>

                  {/* Row 3 - Image */}
                  <div className="pt-2">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                      <ImageIcon size={13} /> Proof Image
                    </label>
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-border/80 rounded-2xl p-8 sm:p-12 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-input/50 hover:border-accent/40 transition-all bg-card"
                    >
                      {imagePreview ? (
                        <div className="relative group">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={imagePreview} alt="Preview" className="h-32 sm:h-40 object-contain rounded-xl shadow-md border border-border/50" />
                          <div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <span className="text-white text-xs font-semibold">Change Image</span>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="h-14 w-14 rounded-full bg-input flex items-center justify-center mb-4 text-primary group-hover:scale-110 transition-transform shadow-sm">
                            <UploadCloud size={24} />
                          </div>
                          <span className="text-sm font-bold text-foreground">Click to upload image</span>
                          <span className="text-xs text-muted-foreground mt-1.5 font-medium">SVG, PNG, JPG or GIF (max. 5MB)</span>
                        </>
                      )}
                    </div>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      ref={fileInputRef}
                      onChange={handleImageChange}
                    />
                  </div>
                </div>

                <div className="mt-10 sm:mt-12 pt-8 border-t border-border/50 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmitting || isUploading}
                    className="w-full sm:w-auto bg-gradient-to-r from-primary to-accent text-white font-semibold px-10 py-3.5 rounded-2xl text-sm hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center shadow-lg shadow-primary/20 active:scale-[0.96]"
                  >
                    {isSubmitting || isUploading ? (
                      <span className="flex items-center gap-2"><Loader2 className="animate-spin" size={18} /> Processing...</span>
                    ) : (
                      "Submit Log Record"
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {activeTab === "search" && (
            <motion.div
              key="search"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="flex flex-col gap-8"
            >
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-accent transition-colors" size={20} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by consumer name, address, or meter number..."
                  className="w-full bg-card border border-border/80 rounded-2xl pl-12 pr-5 py-4 sm:py-4.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent shadow-sm transition-all placeholder:text-muted-foreground/60"
                />
              </div>

              <AnimatePresence mode="wait">
                {filteredLogs.length === 0 ? (
                  <motion.div 
                    key="empty"
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    exit={{ opacity: 0 }}
                    className="text-center text-muted-foreground py-24 bg-card border border-dashed border-border/80 rounded-3xl shadow-sm flex flex-col items-center justify-center gap-3"
                  >
                    <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center text-muted-foreground/50">
                      <LayoutList size={28} />
                    </div>
                    <p className="font-medium text-sm">No meter logs found.<br/>Try adjusting your search criteria.</p>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="grid"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8"
                  >
                    {filteredLogs.map((log, index) => (
                      <motion.div
                        key={log.id || `log-${index}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        layout
                        onClick={() => setSelectedLog(log)}
                        className="glass-panel p-5 sm:p-8 rounded-3xl flex flex-col gap-5 sm:gap-6 hover:border-accent/30 hover:shadow-lg transition-all duration-300 cursor-pointer group"
                      >
                        <div className="flex flex-wrap sm:flex-nowrap justify-between items-start gap-4 sm:gap-5">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-display font-medium text-foreground text-xl truncate tracking-wide group-hover:text-primary transition-colors">{log.consumer_name}</h3>
                            <p className="text-xs text-muted-foreground mt-1 flex items-start gap-1.5 leading-relaxed">
                              <MapPin size={14} className="shrink-0 mt-0.5 text-muted-foreground/70" />
                              <span className="line-clamp-2 font-sans">{log.address}</span>
                            </p>
                          </div>
                          <div className="bg-input text-foreground px-3 py-1.5 rounded-lg text-xs font-mono font-bold border border-border/50 shrink-0 shadow-sm">
                            {log.meter_number}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2 bg-background p-3.5 rounded-xl border border-border/40 text-center">
                          <div className="flex flex-col items-center justify-center py-1">
                            <span className="text-[9px] uppercase font-bold text-muted-foreground/80 tracking-wider">kWh</span>
                            <span className="font-mono font-bold text-foreground text-sm tracking-tight">{log.kwh ?? log.meter_reading}</span>
                          </div>
                          <div className="flex flex-col items-center justify-center py-1 border-x border-border/40">
                            <span className="text-[9px] uppercase font-bold text-muted-foreground/80 tracking-wider">kVAh</span>
                            <span className="font-mono font-bold text-foreground text-sm tracking-tight">{log.kvah ?? "—"}</span>
                          </div>
                          <div className="flex flex-col items-center justify-center py-1">
                            <span className="text-[9px] uppercase font-bold text-muted-foreground/80 tracking-wider">MD</span>
                            <span className="font-mono font-bold text-foreground text-sm tracking-tight">{log.md ?? "—"}</span>
                          </div>
                        </div>

                        {(log.reason || log.location) && (
                          <div className="flex flex-wrap gap-2 text-xs">
                            {log.reason && (
                              <span className="px-2.5 py-1 bg-red-500/10 text-red-500 font-bold rounded-lg border border-red-500/20 capitalize">
                                {log.reason}
                              </span>
                            )}
                            {log.location && (
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(log.location)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="px-2.5 py-1 bg-muted hover:bg-input text-muted-foreground hover:text-primary font-semibold rounded-lg border border-border/50 flex items-center gap-1 transition-colors"
                                title="Show on map"
                              >
                                <MapPin size={10} /> {log.location}
                              </a>
                            )}
                          </div>
                        )}

                        {log.image_url && (
                          <div 
                            className="rounded-xl overflow-hidden border border-border/50 h-44 bg-input relative transition-colors shadow-sm cursor-zoom-in group/img"
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent opening the detail modal
                              setFullscreenImage(log.image_url);
                            }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img 
                              src={log.image_url} 
                              alt="Meter Proof" 
                              className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-500"
                            />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity">
                              <Maximize2 className="text-white drop-shadow-md" size={24} />
                            </div>
                          </div>
                        )}
                        
                        {log.notes && (
                          <div className="text-sm bg-blue-50/50 p-3.5 rounded-xl border border-blue-100/50 text-slate-600 flex gap-2.5 items-start">
                            <FileText size={16} className="mt-0.5 shrink-0 text-blue-400" />
                            <span className="font-medium leading-relaxed line-clamp-2">{log.notes}</span>
                          </div>
                        )}

                        <div className="border-t border-border/50 pt-5 mt-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
                          <div className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1.5 whitespace-nowrap">
                            <Calendar size={12} className="opacity-70" />
                            {new Date(log.created_at).toLocaleString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                          <button 
                            className="text-xs font-bold text-primary flex items-center gap-1 group-hover:text-accent transition-colors bg-primary/5 hover:bg-primary/10 px-3 py-1.5 rounded-lg"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLog(log);
                            }}
                          >
                            View Details <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* --- MODALS --- */}
      <AnimatePresence>
        {/* Detail Modal */}
        {selectedLog && (
          <motion.div
            key="detail-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-sm"
            onClick={() => setSelectedLog(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-card w-full max-w-xl rounded-[2rem] shadow-2xl overflow-hidden border border-border flex flex-col max-h-[90vh]"
              onClick={(e) => e.stopPropagation()} // Prevent click from closing modal
            >
              {/* Modal Header */}
              <div className="px-8 py-6 border-b border-border/60 flex justify-between items-center bg-muted/30">
                <h2 className="font-display text-2xl text-foreground">Log Details</h2>
                <button 
                  onClick={() => setSelectedLog(null)}
                  className="p-2 rounded-full hover:bg-input text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 sm:p-8 md:p-10 overflow-y-auto custom-scrollbar">
                <div className="flex flex-col gap-6 sm:gap-8">
                  {/* Status Banner */}
                  <div className="flex items-center justify-between bg-primary/5 border border-primary/10 p-5 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/20 p-2 rounded-xl text-primary">
                        <Calendar size={20} />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-0.5">Logged On</p>
                        <p className="font-semibold text-foreground text-sm">
                          {new Date(selectedLog.created_at).toLocaleString(undefined, {
                            dateStyle: 'medium',
                            timeStyle: 'short'
                          })}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Core Information */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="bg-input/50 p-3 sm:p-4 rounded-2xl border border-border/40">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-1.5 flex items-center gap-1.5"><User size={12} /> Consumer</p>
                      <p className="font-semibold text-foreground text-sm">{selectedLog.consumer_name}</p>
                    </div>
                    <div className="bg-input/50 p-3 sm:p-4 rounded-2xl border border-border/40">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-1.5 flex items-center gap-1.5"><Hash size={12} /> Meter #</p>
                      <p className="font-mono font-bold text-foreground text-sm">{selectedLog.meter_number}</p>
                    </div>
                    <div className="sm:col-span-2 bg-input/50 p-3 sm:p-4 rounded-2xl border border-border/40">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-1.5 flex items-center gap-1.5"><MapPin size={12} /> Address</p>
                      <p className="font-medium text-foreground text-sm leading-relaxed">{selectedLog.address}</p>
                    </div>
                  </div>

                  {/* Meter Reading details block */}
                  <div className="bg-gradient-to-br from-primary to-accent p-6 rounded-2xl text-white shadow-lg shadow-primary/20 grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-white/80 text-[10px] uppercase tracking-widest font-bold mb-1">kWh</p>
                      <p className="font-mono font-bold text-xl sm:text-2xl">{selectedLog.kwh ?? selectedLog.meter_reading}</p>
                    </div>
                    <div className="border-x border-white/20">
                      <p className="text-white/80 text-[10px] uppercase tracking-widest font-bold mb-1">kVAh</p>
                      <p className="font-mono font-bold text-xl sm:text-2xl">{selectedLog.kvah ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-white/80 text-[10px] uppercase tracking-widest font-bold mb-1">MD</p>
                      <p className="font-mono font-bold text-xl sm:text-2xl">{selectedLog.md ?? "—"}</p>
                    </div>
                  </div>

                  {/* Reason & Location Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {selectedLog.reason && (
                      <div className="bg-red-500/5 p-3 sm:p-4 rounded-2xl border border-red-500/10">
                        <p className="text-[10px] uppercase font-bold text-red-500/80 tracking-widest mb-1.5 flex items-center gap-1.5">Reason</p>
                        <p className="font-bold text-foreground text-sm capitalize">{selectedLog.reason}</p>
                      </div>
                    )}
                    {selectedLog.location && (
                      <div className="bg-input/50 p-3 sm:p-4 rounded-2xl border border-border/40 flex justify-between items-center">
                        <div>
                          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-1.5 flex items-center gap-1.5"><MapPin size={12} /> Coordinates</p>
                          <p className="font-mono font-semibold text-foreground text-sm">{selectedLog.location}</p>
                        </div>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedLog.location)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-primary/10 hover:bg-primary/20 text-primary p-2.5 rounded-xl transition-colors shrink-0 flex items-center justify-center"
                          title="Open in Google Maps"
                        >
                          <MapPin size={16} />
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  {selectedLog.notes && (
                    <div>
                      <p className="text-[11px] uppercase font-bold text-muted-foreground tracking-widest mb-2 flex items-center gap-1.5"><FileText size={12} /> Notes</p>
                      <div className="bg-muted p-4 rounded-2xl border border-border/60 text-sm font-medium text-foreground/80 leading-relaxed">
                        {selectedLog.notes}
                      </div>
                    </div>
                  )}

                  {/* Image */}
                  {selectedLog.image_url && (
                    <div>
                      <p className="text-[11px] uppercase font-bold text-muted-foreground tracking-widest mb-2 flex items-center gap-1.5"><ImageIcon size={12} /> Proof Image</p>
                      <div 
                        className="rounded-2xl overflow-hidden border border-border/80 bg-input cursor-zoom-in relative group"
                        onClick={() => setFullscreenImage(selectedLog.image_url)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={selectedLog.image_url} alt="Full Proof" className="w-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Maximize2 className="text-white drop-shadow-md" size={32} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Fullscreen Image Lightbox Modal */}
        {fullscreenImage && (
          <motion.div
            key="fullscreen-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-8 bg-black/95 backdrop-blur-xl"
            onClick={() => setFullscreenImage(null)}
          >
            <button 
              className="absolute top-4 right-4 sm:top-8 sm:right-8 bg-white/10 hover:bg-white/20 p-3 rounded-full text-white backdrop-blur-sm transition-colors z-[70]"
              onClick={() => setFullscreenImage(null)}
            >
              <X size={24} />
            </button>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative max-w-5xl max-h-full w-full h-full flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={fullscreenImage} 
                alt="Fullscreen Preview" 
                className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" 
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
