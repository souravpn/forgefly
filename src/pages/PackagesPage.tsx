import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Package as PackageIcon, Edit, Trash2, DollarSign, Calendar, Search } from 'lucide-react';
import { toast } from 'sonner';
import type { Package } from '@/types/types';
import { getPackages, createPackage, updatePackage, deletePackage, subscribeToPackages } from '@/services/packageService';

export default function PackagesPage() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    one_time_price: '',
    monthly_price: '',
    features: '',
    is_active: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadPackages();

    const channel = subscribeToPackages(() => {
      loadPackages();
    });

    return () => {
      channel.unsubscribe();
    };
  }, []);

  async function loadPackages() {
    try {
      const data = await getPackages();
      setPackages(data);
    } catch (error) {
      console.error('Error loading packages:', error);
      toast.error('Failed to load packages');
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setFormData({
      name: '',
      description: '',
      one_time_price: '',
      monthly_price: '',
      features: '',
      is_active: true,
    });
    setIsCreateModalOpen(true);
  }

  function openEditModal(pkg: Package) {
    setSelectedPackage(pkg);
    setFormData({
      name: pkg.name,
      description: pkg.description || '',
      one_time_price: pkg.one_time_price?.toString() || '',
      monthly_price: pkg.monthly_price?.toString() || '',
      features: pkg.features || '',
      is_active: pkg.is_active,
    });
    setIsEditModalOpen(true);
  }

  function openDeleteDialog(pkg: Package) {
    setSelectedPackage(pkg);
    setIsDeleteDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (!formData.one_time_price && !formData.monthly_price) {
        toast.error('Please provide at least one price (one-time or monthly)');
        setSubmitting(false);
        return;
      }

      const packageData = {
        name: formData.name,
        description: formData.description || null,
        one_time_price: formData.one_time_price ? parseFloat(formData.one_time_price) : null,
        monthly_price: formData.monthly_price ? parseFloat(formData.monthly_price) : null,
        features: formData.features || null,
        is_active: formData.is_active,
      };

      if (isEditModalOpen && selectedPackage) {
        await updatePackage(selectedPackage.id, packageData);
        toast.success('Package updated successfully!');
        setIsEditModalOpen(false);
      } else {
        await createPackage(packageData);
        toast.success('Package created successfully!');
        setIsCreateModalOpen(false);
      }

      loadPackages();
    } catch (error) {
      console.error('Error saving package:', error);
      toast.error('Failed to save package');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!selectedPackage) return;

    try {
      await deletePackage(selectedPackage.id);
      toast.success('Package deleted successfully!');
      setIsDeleteDialogOpen(false);
      loadPackages();
    } catch (error) {
      console.error('Error deleting package:', error);
      toast.error('Failed to delete package');
    }
  }

  async function handleToggleActive(pkg: Package) {
    try {
      await updatePackage(pkg.id, { is_active: !pkg.is_active });
      toast.success(`Package ${!pkg.is_active ? 'activated' : 'deactivated'}!`);
      loadPackages();
    } catch (error) {
      console.error('Error toggling package status:', error);
      toast.error('Failed to update package status');
    }
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-balance mb-2">Service Packages</h1>
          <p className="text-sm md:text-base text-muted-foreground">Create and manage your service offerings</p>
        </div>
        <Button size="lg" className="glow-accent w-full md:w-auto" onClick={openCreateModal}>
          <Plus className="w-5 h-5 mr-2" />
          Create Package
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="Search packages..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-48 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : packages.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4">
              <PackageIcon className="w-8 h-8 text-accent" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No packages yet</h3>
            <p className="text-muted-foreground mb-6 max-w-sm text-pretty">
              Create service packages to offer your clients flexible pricing options.
            </p>
            <Button onClick={openCreateModal} className="glow-accent">
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Package
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {packages.filter(pkg => {
            const q = searchQuery.toLowerCase();
            return !q || pkg.name.toLowerCase().includes(q) || pkg.description?.toLowerCase().includes(q);
          }).map((pkg) => (
            <Card key={pkg.id} className="card-hover h-full flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{pkg.name}</CardTitle>
                  <Badge variant={pkg.is_active ? 'default' : 'secondary'}>
                    {pkg.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                {pkg.description && (
                  <p className="text-sm text-muted-foreground mb-4 text-pretty">{pkg.description}</p>
                )}

                <div className="space-y-3 mb-4">
                  {pkg.one_time_price && (
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-accent" />
                      <span className="font-semibold text-accent">${pkg.one_time_price.toLocaleString()}</span>
                      <span className="text-sm text-muted-foreground">one-time</span>
                    </div>
                  )}
                  {pkg.monthly_price && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-accent" />
                      <span className="font-semibold text-accent">${pkg.monthly_price.toLocaleString()}</span>
                      <span className="text-sm text-muted-foreground">per month</span>
                    </div>
                  )}
                </div>

                {pkg.features && (
                  <div className="mb-4 flex-1">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Features:</p>
                    <p className="text-sm whitespace-pre-line text-pretty">{pkg.features}</p>
                  </div>
                )}

                <div className="flex flex-col gap-2 pt-4 border-t border-border mt-auto">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <Switch
                      checked={pkg.is_active}
                      onCheckedChange={() => handleToggleActive(pkg)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => openEditModal(pkg)}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openDeleteDialog(pkg)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={isCreateModalOpen || isEditModalOpen} onOpenChange={(open) => {
        if (!open) {
          setIsCreateModalOpen(false);
          setIsEditModalOpen(false);
        }
      }}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditModalOpen ? 'Edit Package' : 'Create New Package'}</DialogTitle>
            <DialogDescription>
              {isEditModalOpen ? 'Update package information' : 'Create a new service package'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Package Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Brand Identity Package"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe what's included in this package..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="one_time_price">One-Time Price ($)</Label>
                  <Input
                    id="one_time_price"
                    type="number"
                    step="0.01"
                    value={formData.one_time_price}
                    onChange={(e) => setFormData({ ...formData, one_time_price: e.target.value })}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="monthly_price">Monthly Price ($)</Label>
                  <Input
                    id="monthly_price"
                    type="number"
                    step="0.01"
                    value={formData.monthly_price}
                    onChange={(e) => setFormData({ ...formData, monthly_price: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                * At least one price type is required
              </p>

              <div className="space-y-2">
                <Label htmlFor="features">Features (one per line)</Label>
                <Textarea
                  id="features"
                  value={formData.features}
                  onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                  placeholder="Custom logo design&#10;Brand guidelines&#10;3 revision rounds"
                  rows={5}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="is_active">Active Package</Label>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setIsEditModalOpen(false);
                }}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="glow-accent">
                {submitting ? 'Saving...' : isEditModalOpen ? 'Update Package' : 'Create Package'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Package</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedPackage?.name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
