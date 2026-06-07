"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/lib/supabase";
import { UploadCloud, Search, Loader2, Image as ImageIcon, MapPin, User, Hash, Zap, FileText, LayoutList, PlusCircle } from "lucide-react";

const logSchema = z.object({
  consumer_name: z.string().min(1, "Consumer name is required"),
  address: z.string().min(1, "Address is required"),
  meter_number: z.string().regex(/^[a-zA-Z0-9]+$/, "Meter number must be alphanumeric"),
  meter_reading: z.number().positive("Reading must be positive"),
  notes: z.string().optional(),
});

type LogFormData = z.infer<typeof logSchema>;

type LogRecord = {
  id: string;
  consumer_name: string;
  address: string;
  meter_number: string;
  meter_reading: number;
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
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LogFormData>({
    resolver: zodResolver(logSchema),
  });

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
        // eslint-disable-next-line react-hooks/purity
        const randomSuffix = Math.random().toString(36).substring(7);
        // eslint-disable-next-line react-hooks/purity
        const fileName = `${Date.now()}-${randomSuffix}-${imageFile.name}`;
        
        const { error: uploadError } = await supabase.storage
          .from("meter-images")
          .upload(fileName, imageFile);

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
          meter_reading: data.meter_reading,
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
      console.error("Submission failed", error instanceof Error ? error.message : error);
      setIsUploading(false);
    }
  };

  const filteredLogs = useMemo(() => {
    if (!searchQuery) return logs;
    const query = searchQuery.toLowerCase();
    return logs.filter(
      (log) =>
        log.consumer_name?.toLowerCase().includes(query) ||
        log.address?.toLowerCase().includes(query)
    );
  }, [logs, searchQuery]);

  return (
    <div className="min-h-[100dvh] bg-background text-foreground font-sans flex flex-col items-center py-6 px-4 sm:py-10 sm:px-6 lg:px-8">
      
      {/* Header Container */}
      <div className="w-full max-w-4xl mb-6 sm:mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-5">
        <div>
          <h1 className="text-3xl sm:text-4xl font-display text-foreground">VoltTrack</h1>
          <p className="text-muted-foreground text-sm mt-1 font-medium">Power Supply Field Manager</p>
        </div>

        {/* Segmented Control Tab Navigation */}
        <div className="flex bg-muted p-1 rounded-2xl shadow-inner border border-border/60 relative self-start sm:self-auto w-full sm:w-auto">
          <button
            onClick={() => setActiveTab("entry")}
            className={`relative flex-1 sm:flex-none flex justify-center items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl transition-colors z-10 ${
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
            className={`relative flex-1 sm:flex-none flex justify-center items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl transition-colors z-10 ${
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
              <form onSubmit={handleSubmit(onSubmit)} className="glass-panel p-5 sm:p-8 rounded-2xl sm:rounded-3xl border-border/80 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)]">
                <div className="space-y-6 sm:space-y-8">
                  {/* Row 1 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                        <User size={13} /> Consumer Name
                      </label>
                      <input
                        {...register("consumer_name")}
                        className="w-full bg-input border border-border/50 rounded-xl px-4 py-3 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:bg-card transition-all placeholder:text-muted-foreground/50"
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
                        className="w-full bg-input border border-border/50 rounded-xl px-4 py-3 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:bg-card transition-all placeholder:text-muted-foreground/50 uppercase"
                        placeholder="e.g. MT12345"
                      />
                      {errors.meter_number && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.meter_number.message}</p>}
                    </div>
                  </div>

                  {/* Row 2 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                        <MapPin size={13} /> Address
                      </label>
                      <textarea
                        {...register("address")}
                        className="w-full bg-input border border-border/50 rounded-xl px-4 py-3 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:bg-card transition-all resize-none h-[122px] placeholder:text-muted-foreground/50"
                        placeholder="e.g. 123 Energy Ave, City, ST"
                      />
                      {errors.address && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.address.message}</p>}
                    </div>

                    <div className="space-y-6 sm:space-y-8">
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                          <Zap size={13} /> Reading (kWh)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          {...register("meter_reading", { valueAsNumber: true })}
                          className="w-full bg-input border border-border/50 rounded-xl px-4 py-3 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:bg-card transition-all placeholder:text-muted-foreground/50"
                          placeholder="0.00"
                        />
                        {errors.meter_reading && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.meter_reading.message}</p>}
                      </div>
                      
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                          <FileText size={13} /> Notes <span className="lowercase font-normal text-muted-foreground/60">(optional)</span>
                        </label>
                        <input
                          {...register("notes")}
                          className="w-full bg-input border border-border/50 rounded-xl px-4 py-3 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:bg-card transition-all placeholder:text-muted-foreground/50"
                          placeholder="Any observations..."
                        />
                      </div>
                    </div>
                  </div>

                  {/* Row 3 - Image */}
                  <div className="pt-2">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                      <ImageIcon size={13} /> Proof Image
                    </label>
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-border/80 rounded-2xl p-6 sm:p-10 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-input/50 hover:border-accent/40 transition-all bg-card shadow-[inset_0_2px_10px_-5px_rgba(0,0,0,0.03)]"
                    >
                      {imagePreview ? (
                        <div className="relative group">
                          <img src={imagePreview} alt="Preview" className="h-32 sm:h-40 object-contain rounded-xl shadow-md border border-border/50" />
                          <div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <span className="text-white text-xs font-semibold">Change Image</span>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="h-14 w-14 rounded-full bg-input flex items-center justify-center mb-4 text-accent/80 group-hover:scale-110 transition-transform shadow-sm">
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

                <div className="mt-8 sm:mt-10 pt-6 border-t border-border/50 flex justify-end">
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
              className="flex flex-col gap-6"
            >
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-accent transition-colors" size={20} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by consumer name or address..."
                  className="w-full bg-card border border-border/80 rounded-2xl pl-12 pr-4 py-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent shadow-sm transition-all placeholder:text-muted-foreground/60"
                />
              </div>

              <AnimatePresence>
                {filteredLogs.length === 0 ? (
                  <motion.div 
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {filteredLogs.map((log, index) => (
                      <motion.div
                        key={log.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        layout
                        className="glass-panel p-6 rounded-2xl flex flex-col gap-5 hover:border-accent/30 hover:shadow-lg transition-all duration-300"
                      >
                        <div className="flex justify-between items-start gap-4">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-display font-medium text-foreground text-xl truncate tracking-wide">{log.consumer_name}</h3>
                            <p className="text-xs text-muted-foreground mt-1 flex items-start gap-1.5 leading-relaxed">
                              <MapPin size={14} className="shrink-0 mt-0.5 text-muted-foreground/70" />
                              <span className="line-clamp-2 font-sans">{log.address}</span>
                            </p>
                          </div>
                          <div className="bg-input text-foreground px-3 py-1.5 rounded-lg text-xs font-mono font-bold border border-border/50 shrink-0 shadow-sm">
                            {log.meter_number}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm bg-background p-3.5 rounded-xl border border-border/40">
                          <div className="flex items-center gap-2">
                            <div className="bg-accent/10 text-accent p-1.5 rounded-md">
                              <Zap size={14} className="fill-accent" />
                            </div>
                            <span className="font-mono font-bold text-foreground text-base tracking-tight">{log.meter_reading}</span>
                            <span className="text-[10px] uppercase font-bold text-muted-foreground/80 tracking-widest mt-0.5">kWh</span>
                          </div>
                          <div className="w-px h-6 bg-border/60"></div>
                          <div className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                            {new Date(log.created_at).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </div>
                        </div>

                        {log.image_url && (
                          <div className="rounded-xl overflow-hidden border border-border/50 h-44 bg-input relative transition-colors shadow-sm">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img 
                              src={log.image_url} 
                              alt="Meter Proof" 
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        
                        {log.notes && (
                          <div className="text-sm bg-blue-50/50 p-3.5 rounded-xl border border-blue-100/50 text-slate-600 flex gap-2.5 items-start">
                            <FileText size={16} className="mt-0.5 shrink-0 text-blue-400" />
                            <span className="font-medium leading-relaxed">{log.notes}</span>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

    </div>
  );
}
