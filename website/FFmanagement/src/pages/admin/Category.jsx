import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from 'react-router-dom';
import { getCategories } from "@/api/categories";
import { useEffect, useState } from "react";
import Table from "@/components/admin/Table";
import { Plus, Search, Filter, ArrowUpDown, ChevronRight } from "lucide-react";

export default function CategoryPage() {
  const navigate = useNavigate();
  const [categoriesData, setCategoriesData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    setLoading(true);
    const getCategoriesData = async () => {
      try {
        const response = await getCategories();
        if (response?.categories) {
          setCategoriesData(response.categories);
        }
      } catch (error) {
        console.error("Error fetching categories:", error);
      } finally {
        setLoading(false);
      }
    };
    getCategoriesData();
  }, []);

  const CategoryColumns = [
    { header: "#", accessor: "_index", render: (_, __, i) => i + 1 },
    {
      header: "Logo",
      accessor: "logo",
      render: (value) => (
        <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-white shadow-sm border border-gray-100 p-1">
          {value?.url ? (
            <img src={value.url} alt="Logo" className="h-full w-full object-contain rounded-lg" />
          ) : (
            <span className="text-[10px] text-gray-400 font-medium">No Logo</span>
          )}
        </div>
      ),
    },
    {
      header: "Image",
      accessor: "image",
      render: (value) => (
        <div className="h-12 w-12 rounded-xl overflow-hidden border border-gray-100 shadow-sm">
          {value?.url ? (
            <img src={value.url} alt="Category" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-gray-50 flex items-center justify-center">
              <span className="text-[10px] text-gray-400 font-medium">No Image</span>
            </div>
          )}
        </div>
      ),
    },
    { header: "Name", accessor: "name", render: (value) => <span className="font-semibold text-gray-900">{value}</span> },
    { header: "Slug", accessor: "slug", render: (value) => <span className="text-gray-500 text-xs font-mono bg-gray-50 px-2 py-1 rounded-md">{value}</span> },
    {
      header: "Level",
      accessor: "level",
      render: (value) => (
        <div className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${value === 0 ? 'bg-blue-500' : value === 1 ? 'bg-purple-500' : 'bg-pink-500'}`} />
          <span className="text-xs font-medium text-gray-700">
            {value === 0 ? 'Top Tier' : value === 1 ? 'Sub Category' : 'Service Layer'}
          </span>
        </div>
      )
    },
    {
      header: "Status",
      accessor: "isActive",
      render: (value) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${value
          ? "bg-emerald-50 text-emerald-700 border-emerald-100"
          : "bg-rose-50 text-rose-700 border-rose-100"
          }`}>
          <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${value ? 'bg-emerald-500' : 'bg-rose-500'}`} />
          {value ? "Active" : "Archived"}
        </span>
      ),
    },
  ];

  const CategoryActions = [
    {
      label: "Edit",
      onClick: (row) => navigate(`/admin/edit-category/${row._id}`),
      className: "inline-flex items-center px-2.5 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors duration-200",
    },
    {
      label: "View Items",
      onClick: (row) => navigate(`/admin/products/merchant/${row._id}`),
      className: "inline-flex items-center px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors duration-200",
    },
    {
      label: "Delete",
      onClick: (row) => console.log("Delete", row),
      className: "inline-flex items-center px-2.5 py-1.5 text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors duration-200",
    },
  ];

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Catalog Intelligence</h1>
          <p className="mt-1 text-sm text-gray-500">Manage and organize your product categories with precision.</p>
        </div>
        <Button
          onClick={() => navigate('/admin/add-category')}
          className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200 gap-2 px-6 py-6 rounded-2xl transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0"
        >
          <Plus className="h-5 w-5" />
          <span className="font-semibold text-base">New Category</span>
        </Button>
      </div>

      {/* Control Bar - Glassmorphism Effect */}
      <div className="sticky top-4 z-10 mb-6 flex flex-col gap-4 rounded-3xl border border-white/40 bg-white/70 p-4 shadow-xl backdrop-blur-xl lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <Input
            type="text"
            placeholder="Search across all categories..."
            className="h-12 border-none bg-transparent pl-12 shadow-none focus-visible:ring-0 text-gray-700 placeholder:text-gray-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4 lg:border-none lg:pt-0">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-gray-400" />
            <Select>
              <SelectTrigger className="h-11 w-[140px] rounded-xl border-gray-100 bg-white shadow-sm ring-0 transition-all hover:bg-gray-50">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="latest">Recent First</SelectItem>
                <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                <SelectItem value="name-desc">Name (Z-A)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <Select>
              <SelectTrigger className="h-11 w-[140px] rounded-xl border-gray-100 bg-white shadow-sm ring-0 transition-all hover:bg-gray-50">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="inactive">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <Table
        data={categoriesData.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))}
        columns={CategoryColumns}
        actions={CategoryActions}
      />
    </div>
  );
}
