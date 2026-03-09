"use client";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
}

export function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = "Confirmer",
    cancelText = "Annuler",
    isDestructive = false,
}: ConfirmModalProps) {
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="bg-[#36393f] text-[#dcddde] border-none sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="text-white font-bold text-xl">{title}</DialogTitle>
                    <DialogDescription className="text-[#b9bbbe] mt-2">
                        {message}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="bg-[#2f3136] -m-6 mt-2 p-4 flex justify-end gap-2">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        className="text-[#dcddde] hover:underline"
                    >
                        {cancelText}
                    </Button>
                    <Button
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        className={`${isDestructive
                            ? "bg-[#ED4245] hover:bg-[#c03537]"
                            : "bg-[#5865F2] hover:bg-[#4752c4]"} text-white`}
                    >
                        {confirmText}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
