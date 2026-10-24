"use client";

import { useEffect, useRef, useState } from "react";
import {
  Button,
  Card,
  CardBody,
  Chip,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Spinner,
  Checkbox,
} from "@heroui/react";
import { Camera, Upload, Sparkles, Trash2, Plus, Key, Image as ImageIcon, CheckCircle, RefreshCw } from "lucide-react";
import type { FlowerBillItem } from "@/lib/types";
import {
  COMMON_TELUGU_FLOWERS,
  getGeminiApiKey,
  saveGeminiApiKey,
  scanFlowersFromImage,
} from "@/lib/geminiFlowers";

interface FlowerBillScannerProps {
  initialItems?: FlowerBillItem[];
  initialReceiptImage?: string;
  initialTotalAmount?: string;
  onApply: (
    items: FlowerBillItem[],
    totalAmount: string,
    receiptImage: string,
    updateInvestment: boolean
  ) => void;
}

export default function FlowerBillScanner({
  initialItems = [],
  initialReceiptImage = "",
  initialTotalAmount = "",
  onApply,
}: FlowerBillScannerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [image, setImage] = useState<string>(initialReceiptImage);
  const [items, setItems] = useState<FlowerBillItem[]>(initialItems);
  const [total, setTotal] = useState<string>(initialTotalAmount);
  const [detectedLang, setDetectedLang] = useState<string>("");
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [updateInvestment, setUpdateInvestment] = useState(true);

  // API Key management
  const [apiKey, setApiKey] = useState("");
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [tempApiKey, setTempApiKey] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const key = getGeminiApiKey();
    setApiKey(key);
    setTempApiKey(key);
  }, []);

  useEffect(() => {
    if (initialItems.length > 0 && items.length === 0) {
      setItems(initialItems);
    }
    if (initialReceiptImage && !image) {
      setImage(initialReceiptImage);
    }
    if (initialTotalAmount && !total) {
      setTotal(initialTotalAmount);
    }
  }, [initialItems, initialReceiptImage, initialTotalAmount]);

  // Recalculate total whenever items change
  function recalculateTotal(newItems: FlowerBillItem[]): void {
    const sum = newItems.reduce((acc, it) => acc + (parseFloat(it.amount) || 0), 0);
    setTotal(sum > 0 ? String(sum) : "");
  }

  function handleFileSelect(files: FileList | null): void {
    if (!files || files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImage(dataUrl);
      setIsOpen(true);
      setScanError("");

      const currentKey = getGeminiApiKey();
      if (currentKey) {
        performScan(dataUrl, currentKey);
      } else {
        setShowKeyInput(true);
      }
    };
    reader.readAsDataURL(file);
  }

  async function performScan(dataUrl: string, keyToUse?: string): Promise<void> {
    const key = (keyToUse || apiKey || getGeminiApiKey()).trim();
    if (!key) {
      setShowKeyInput(true);
      return;
    }

    setScanning(true);
    setScanError("");
    try {
      const result = await scanFlowersFromImage(dataUrl, key);
      setItems(result.items);
      setTotal(result.totalAmount);
      setDetectedLang(result.languageDetected || "Telugu & English");
      setShowKeyInput(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setScanError(msg);
      if (msg.includes("API_KEY_INVALID") || msg.includes("API key")) {
        setShowKeyInput(true);
      }
    } finally {
      setScanning(false);
    }
  }

  function handleSaveKey(): void {
    const trimmed = tempApiKey.trim();
    saveGeminiApiKey(trimmed);
    setApiKey(trimmed);
    setShowKeyInput(false);
    if (image && trimmed) {
      performScan(image, trimmed);
    }
  }

  function updateItem(index: number, field: keyof FlowerBillItem, val: string): void {
    const next = [...items];
    next[index] = { ...next[index], [field]: val };
    setItems(next);
    if (field === "amount") {
      recalculateTotal(next);
    }
  }

  function addItem(presetName = ""): void {
    const next = [...items, { name: presetName, qty: "", amount: "" }];
    setItems(next);
  }

  function removeItem(index: number): void {
    const next = items.filter((_, i) => i !== index);
    setItems(next);
    recalculateTotal(next);
  }

  function handleApply(): void {
    onApply(items, total, image, updateInvestment);
    setIsOpen(false);
  }

  return (
    <div className="space-y-3">
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handleFileSelect(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          handleFileSelect(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Upload Banner / Card */}
      <Card className="bg-gradient-to-r from-primary/10 via-secondary/10 to-primary/5 border border-primary/25">
        <CardBody className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-primary animate-pulse" />
                <h4 className="font-semibold text-sm sm:text-base text-foreground">
                  AI Flower Bill Scanner / పూల చిట్టీ స్కాన్
                </h4>
                <Chip size="sm" variant="flat" color="secondary" className="text-[10px]">
                  Telugu &amp; English
                </Chip>
              </div>
              <p className="text-xs text-foreground/70">
                Upload or photograph a handwritten flower market bill, slip, or chit. Automatically extracts flower items,
                quantities, and amounts in Telugu or English.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="flat"
                color="primary"
                startContent={<Upload size={14} />}
                onPress={() => fileInputRef.current?.click()}
              >
                Upload Bill
              </Button>
              <Button
                size="sm"
                variant="bordered"
                color="secondary"
                startContent={<Camera size={14} />}
                onPress={() => cameraInputRef.current?.click()}
              >
                Camera
              </Button>
              {items.length > 0 && (
                <Button size="sm" variant="light" color="success" onPress={() => setIsOpen(true)}>
                  View List ({items.length})
                </Button>
              )}
            </div>
          </div>

          {/* Active summary if items already loaded */}
          {items.length > 0 && !isOpen && (
            <div className="mt-3 pt-3 border-t border-primary/20 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <CheckCircle size={14} className="text-success" />
                <span className="text-foreground/80 font-medium">
                  {items.length} flower item{items.length === 1 ? "" : "s"} listed
                </span>
                {total && (
                  <Chip size="sm" variant="solid" color="primary" className="text-[11px] font-semibold">
                    Total: ₹{parseFloat(total).toLocaleString("en-IN")}
                  </Chip>
                )}
                {image && (
                  <span className="text-foreground/50 inline-flex items-center gap-1">
                    <ImageIcon size={12} /> Slip attached
                  </span>
                )}
              </div>
              <Button size="sm" variant="light" className="text-xs h-7 min-w-0" onPress={() => setIsOpen(true)}>
                Edit list &amp; amounts →
              </Button>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Scanner & Items Review Modal */}
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        size="2xl"
        scrollBehavior="inside"
        classNames={{
          backdrop: "bg-[#241129]/80 backdrop-blur-sm",
        }}
      >
        <ModalContent className="bg-content1 border border-[#D9A427]/30">
          {(onClose) => (
            <>
              <ModalHeader className="flex items-center justify-between pb-2 border-b border-divider/40">
                <div className="flex items-center gap-2">
                  <Sparkles size={18} className="text-primary" />
                  <span className="font-semibold text-lg text-[#F8F4E6]">
                    Flower Bill Items &amp; Amount
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="light"
                  isIconOnly
                  aria-label="API key settings"
                  title="Configure Gemini API Key"
                  onPress={() => setShowKeyInput(!showKeyInput)}
                >
                  <Key size={16} className={apiKey ? "text-success" : "text-warning"} />
                </Button>
              </ModalHeader>

              <ModalBody className="py-4 space-y-4">
                {/* API Key Input Panel (if toggled or missing) */}
                {showKeyInput && (
                  <Card className="bg-content2 border border-warning/40">
                    <CardBody className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-warning flex items-center gap-1.5">
                          <Key size={14} /> Gemini API Key (Required for AI Image Scanning)
                        </span>
                        <a
                          href="https://aistudio.google.com/app/apikey"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-primary underline"
                        >
                          Get Free Key ↗
                        </a>
                      </div>
                      <p className="text-[11px] text-foreground/70">
                        Paste your Google Gemini API key below. It is stored securely in your browser so you only enter it once.
                      </p>
                      <div className="flex items-center gap-2">
                        <Input
                          size="sm"
                          variant="bordered"
                          placeholder="AIzaSy..."
                          value={tempApiKey}
                          onValueChange={setTempApiKey}
                          type="password"
                          className="flex-1"
                        />
                        <Button size="sm" color="primary" onPress={handleSaveKey}>
                          Save &amp; Scan
                        </Button>
                      </div>
                    </CardBody>
                  </Card>
                )}

                {/* Upload preview and Re-scan banner */}
                {image && (
                  <div className="flex flex-col sm:flex-row items-center gap-3 p-3 rounded-lg bg-content2/60 border border-content3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image}
                      alt="Scanned flower bill"
                      className="w-24 h-24 object-cover rounded-md border border-content3 cursor-pointer hover:opacity-90"
                      onClick={() => window.open(image, "_blank")}
                      title="Click to view full image"
                    />
                    <div className="flex-1 space-y-1 text-center sm:text-left">
                      <p className="text-xs font-semibold text-foreground">Scanned Receipt / Chit</p>
                      <p className="text-[11px] text-foreground/60">
                        {detectedLang ? `Detected language: ${detectedLang}` : "Image loaded. Ready to parse."}
                      </p>
                      <div className="flex items-center gap-2 pt-1 justify-center sm:justify-start flex-wrap">
                        <Button
                          size="sm"
                          variant="bordered"
                          color="primary"
                          className="h-7 text-xs"
                          isLoading={scanning}
                          startContent={!scanning ? <RefreshCw size={12} /> : undefined}
                          onPress={() => performScan(image)}
                        >
                          Re-scan image
                        </Button>
                        <Button
                          size="sm"
                          variant="light"
                          className="h-7 text-xs"
                          onPress={() => fileInputRef.current?.click()}
                        >
                          Choose different image
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Scanning Spinner */}
                {scanning && (
                  <div className="py-8 flex flex-col items-center justify-center space-y-3">
                    <Spinner size="lg" color="primary" />
                    <p className="text-sm font-medium text-primary animate-pulse">
                      Analyzing slip with Telugu &amp; English flower models…
                    </p>
                    <p className="text-xs text-foreground/50">Reading flower names, quantities, and amounts</p>
                  </div>
                )}

                {/* Error message */}
                {scanError && (
                  <div className="p-3 rounded-md bg-danger/10 border border-danger/40 text-danger text-xs space-y-1">
                    <p className="font-semibold">Scan Error</p>
                    <p>{scanError}</p>
                    <div className="pt-1">
                      <Button size="sm" variant="flat" color="danger" className="h-6 text-[10px]" onPress={() => setShowKeyInput(true)}>
                        Check API Key
                      </Button>
                    </div>
                  </div>
                )}

                {/* Extracted Items Table */}
                {!scanning && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-semibold uppercase tracking-wider text-secondary" style={{ fontFamily: "var(--font-mono)" }}>
                        Items &amp; Amount List ({items.length})
                      </h5>
                      <Button
                        size="sm"
                        variant="bordered"
                        color="secondary"
                        className="h-7 text-xs"
                        startContent={<Plus size={12} />}
                        onPress={() => addItem("")}
                      >
                        Add Item
                      </Button>
                    </div>

                    {items.length === 0 ? (
                      <div className="text-center py-6 border border-dashed border-content3 rounded-lg space-y-2">
                        <p className="text-sm text-foreground/60">No items listed yet.</p>
                        <p className="text-xs text-foreground/40">
                          Upload an image to auto-scan or click below to add manually.
                        </p>
                        <Button size="sm" variant="flat" color="primary" onPress={() => addItem("")}>
                          + Add Item Manually
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="grid grid-cols-12 gap-2 text-[11px] font-semibold text-foreground/60 uppercase px-1">
                          <span className="col-span-5 sm:col-span-6">Flower Item (Telugu / English)</span>
                          <span className="col-span-3 sm:col-span-3">Qty / Details</span>
                          <span className="col-span-3 sm:col-span-2">Amount (₹)</span>
                          <span className="col-span-1 text-right"></span>
                        </div>

                        {items.map((it, idx) => (
                          <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-content2/40 p-1.5 rounded-md border border-content3">
                            <div className="col-span-5 sm:col-span-6">
                              <Input
                                size="sm"
                                variant="bordered"
                                placeholder="e.g. చామంతి (Chrysanthemum)"
                                value={it.name}
                                onValueChange={(val) => updateItem(idx, "name", val)}
                              />
                            </div>
                            <div className="col-span-3 sm:col-span-3">
                              <Input
                                size="sm"
                                variant="bordered"
                                placeholder="e.g. 10 kg, 2 bunches"
                                value={it.qty}
                                onValueChange={(val) => updateItem(idx, "qty", val)}
                              />
                            </div>
                            <div className="col-span-3 sm:col-span-2">
                              <Input
                                size="sm"
                                type="number"
                                min={0}
                                variant="bordered"
                                placeholder="₹ Amount"
                                value={it.amount}
                                onValueChange={(val) => updateItem(idx, "amount", val)}
                              />
                            </div>
                            <div className="col-span-1 flex justify-end">
                              <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                color="danger"
                                aria-label="Delete item"
                                onPress={() => removeItem(idx)}
                              >
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Common Telugu flower shortcuts */}
                    <div className="space-y-1.5 pt-1">
                      <p className="text-[11px] text-foreground/50">Quick add popular Telugu flowers:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {COMMON_TELUGU_FLOWERS.map((fl) => (
                          <button
                            key={fl.name}
                            type="button"
                            onClick={() => addItem(fl.name)}
                            className="text-[11px] px-2 py-0.5 rounded-full bg-content2 hover:bg-primary/20 hover:text-primary transition-colors text-foreground/80 border border-content3"
                          >
                            + {fl.te}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Total Summary Row */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-lg bg-primary/10 border border-primary/30 mt-3">
                      <div className="space-y-0.5">
                        <span className="text-xs uppercase text-foreground/60 font-medium">Total Flower Amount</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-bold text-primary" style={{ fontFamily: "var(--font-display)" }}>
                            ₹{total ? parseFloat(total).toLocaleString("en-IN") : "0"}
                          </span>
                          <span className="text-xs text-foreground/50">
                            ({items.length} item{items.length === 1 ? "" : "s"})
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Input
                          size="sm"
                          type="number"
                          label="Total (₹)"
                          variant="bordered"
                          value={total}
                          onValueChange={setTotal}
                          className="w-32"
                        />
                      </div>
                    </div>

                    {/* Investment check */}
                    <div className="pt-2">
                      <Checkbox
                        isSelected={updateInvestment}
                        onValueChange={setUpdateInvestment}
                        size="sm"
                        color="primary"
                      >
                        <span className="text-xs text-foreground/80">
                          Also update <strong>Flower Investment</strong> in invoice (₹{total || 0})
                        </span>
                      </Checkbox>
                    </div>
                  </div>
                )}
              </ModalBody>

              <ModalFooter className="border-t border-divider/40">
                <Button variant="light" size="sm" onPress={onClose}>
                  Cancel
                </Button>
                <Button
                  color="primary"
                  size="sm"
                  className="font-semibold"
                  isDisabled={items.length === 0}
                  onPress={handleApply}
                >
                  Apply {items.length} Items to Flowers
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
