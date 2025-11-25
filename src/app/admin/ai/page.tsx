"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useState } from "react";
import { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Types for AI models and features
interface AIModel {
    _id: Id<"aiModels">;
    name: string;
    provider: "openai" | "google";
    modelId: string;
    isEnabled: boolean;
}

interface AIFeature {
    _id: Id<"aiFeatures">;
    name: string;
    key: string;
    description?: string;
    currentModelId?: string;
}

export default function AIAdminPage() {
    const models = useQuery(api.aiConfig.getAllModels);
    const features = useQuery(api.aiConfig.getAllFeatures);
    const upsertModel = useMutation(api.aiConfig.upsertModel);
    const deleteModel = useMutation(api.aiConfig.deleteModel);
    const updateFeatureMapping = useMutation(api.aiConfig.updateFeatureMapping);
    const initializeDefaults = useMutation(api.aiConfig.initializeDefaults);

    const [isAddingModel, setIsAddingModel] = useState(false);
    const [newModel, setNewModel] = useState({
        name: "",
        provider: "openai" as "openai" | "google",
        modelId: "",
        isEnabled: true,
    });

    const handleAddModel = async () => {
        try {
            await upsertModel(newModel);
            setIsAddingModel(false);
            setNewModel({
                name: "",
                provider: "openai",
                modelId: "",
                isEnabled: true,
            });
            toast.success("Model added successfully");
        } catch {
            toast.error("Failed to add model");
        }
    };

    const handleToggleModel = async (id: Id<"aiModels">, isEnabled: boolean, model: { name: string; provider: "openai" | "google"; modelId: string }) => {
        try {
            await upsertModel({
                id,
                name: model.name,
                provider: model.provider,
                modelId: model.modelId,
                isEnabled,
            });
            toast.success("Model updated");
        } catch {
            toast.error("Failed to update model");
        }
    };

    const handleDeleteModel = async (id: Id<"aiModels">) => {
        try {
            await deleteModel({ id });
            toast.success("Model deleted successfully");
        } catch {
            toast.error("Failed to delete model");
        }
    };

    const handleFeatureChange = async (featureId: Id<"aiFeatures">, modelId: Id<"aiModels">) => {
        try {
            await updateFeatureMapping({ featureId, modelId });
            toast.success("Feature mapping updated");
        } catch {
            toast.error("Failed to update feature mapping");
        }
    };

    if (!models || !features) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="container mx-auto py-8 space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">AI Configuration</h1>
                    <p className="text-muted-foreground">
                        Manage AI models and feature mappings
                    </p>
                </div>
                <Button onClick={() => initializeDefaults({})}>
                    Reset / Initialize Defaults
                </Button>
            </div>

            <div className="grid gap-8 md:grid-cols-2">
                {/* Models Section */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>AI Models</CardTitle>
                            <CardDescription>
                                Configure available AI models. API Keys must be set in environment variables.
                            </CardDescription>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsAddingModel(!isAddingModel)}
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Model
                        </Button>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {isAddingModel && (
                            <div className="p-4 border rounded-lg space-y-4 bg-muted/50">
                                <div className="grid gap-2">
                                    <Label>Name</Label>
                                    <Input
                                        value={newModel.name}
                                        onChange={(e) =>
                                            setNewModel({ ...newModel, name: e.target.value })
                                        }
                                        placeholder="e.g. GPT-4o"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Provider</Label>
                                    <Select
                                        value={newModel.provider}
                                        onValueChange={(v: "openai" | "google") =>
                                            setNewModel({ ...newModel, provider: v })
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="openai">OpenAI</SelectItem>
                                            <SelectItem value="google">Google (Gemini)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label>Model ID</Label>
                                    <Input
                                        value={newModel.modelId}
                                        onChange={(e) =>
                                            setNewModel({ ...newModel, modelId: e.target.value })
                                        }
                                        placeholder="e.g. gpt-4o"
                                    />
                                </div>
                                <Button onClick={handleAddModel} className="w-full">
                                    <Save className="w-4 h-4 mr-2" />
                                    Save Model
                                </Button>
                            </div>
                        )}

                        <div className="space-y-2">
                            {models.map((model: AIModel) => (
                                <div
                                    key={model._id}
                                    className="flex items-center justify-between p-3 border rounded-lg"
                                >
                                    <div>
                                        <div className="font-medium">{model.name}</div>
                                        <div className="text-sm text-muted-foreground">
                                            {model.provider} • {model.modelId}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Switch
                                            checked={model.isEnabled}
                                            onCheckedChange={(checked) =>
                                                handleToggleModel(model._id, checked, model)
                                            }
                                        />
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/90">
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Delete Model</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Are you sure you want to delete {model.name}? This action cannot be undone.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteModel(model._id)} className="bg-destructive hover:bg-destructive/90">
                                                        Delete
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Features Section */}
                <Card>
                    <CardHeader>
                        <CardTitle>Feature Mapping</CardTitle>
                        <CardDescription>
                            Select which model powers each feature.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {features.map((feature: AIFeature) => (
                            <div key={feature._id} className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-base">{feature.name}</Label>
                                    <span className="text-xs text-muted-foreground">
                                        {feature.key}
                                    </span>
                                </div>
                                <p className="text-sm text-muted-foreground mb-2">
                                    {feature.description}
                                </p>
                                <Select
                                    value={feature.currentModelId}
                                    onValueChange={(val) =>
                                        handleFeatureChange(feature._id, val as Id<"aiModels">)
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a model" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {models
                                            .filter((m: AIModel) => m.isEnabled)
                                            .map((model: AIModel) => (
                                                <SelectItem key={model._id} value={model._id}>
                                                    {model.name} ({model.provider})
                                                </SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
