import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from 'react-router-dom';
import { getCategories } from "@/api/categories";
import { useEffect, useState, useMemo } from "react";
import Table from "@/components/admin/Table";
import { Plus, Search, Filter, ArrowUpDown, ChevronRight, Layers } from "lucide-react";

export default function CategoryPage() {
  const navigate = useNavigate();
  const [categoriesData, setCategoriesData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [sortBy, setSortBy] = useState("hierarchy");

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

  // Quick lookup map for parent names
  const parentCategoryMap = useMemo(() => {
    const map = {};
    categoriesData.forEach(c => {
      if (c._id) map[c._id] = c;
    });
    return map;
  }, [categoriesData]);

  const filteredCategories = useMemo(() => {
    // 1. Filter by search, status, and level
    const filtered = categoriesData.filter((c) => {
      const parentName = c.ancestors?.parentName || parentCategoryMap[c.parentId]?.name || "";
      const matchesSearch =
        (c.name && c.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.slug && c.slug.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (parentName && parentName.toLowerCase().includes(searchTerm.toLowerCase()));
      if (!matchesSearch) return false;

      if (statusFilter === "active") return c.isActive === true;
      if (statusFilter === "inactive") return c.isActive === false;

      if (levelFilter === "0") return c.level === 0;
      if (levelFilter === "1") return c.level === 1;

      return true;
    });

    // 2. Hierarchical sorting: Group Level 0 (parents) and immediately follow with their Level 1 (subcategories)
    if (sortBy === "hierarchy") {
      if (levelFilter === "1") {
        return [...filtered].sort((a, b) => {
          const pA = a.ancestors?.parentName || parentCategoryMap[a.parentId]?.name || "";
          const pB = b.ancestors?.parentName || parentCategoryMap[b.parentId]?.name || "";
          if (pA !== pB) return pA.localeCompare(pB);
          return (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.name || "").localeCompare(b.name || "");
        });
      }

      const roots = [];
      const childrenByParent = new Map();

      filtered.forEach((cat) => {
        if (cat.level === 0) {
          roots.push(cat);
        } else if (cat.parentId) {
          const pId = cat.parentId.toString();
          if (!childrenByParent.has(pId)) {
            childrenByParent.set(pId, []);
          }
          childrenByParent.get(pId).push(cat);
        }
      });

      // Sort roots by sortOrder (asc) then name (asc)
      roots.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.name || "").localeCompare(b.name || ""));

      // Sort children within each parent by sortOrder (asc) then name (asc)
      childrenByParent.forEach((children) => {
        children.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.name || "").localeCompare(b.name || ""));
      });

      const result = [];
      const visitedChildrenIds = new Set();

      roots.forEach((root) => {
        result.push(root);
        const children = childrenByParent.get(root._id?.toString()) || [];
        children.forEach((child) => {
          result.push(child);
          visitedChildrenIds.add(child._id?.toString());
        });
      });

      // Append any subcategories whose parent wasn't matched in roots (e.g. filtered by search)
      filtered.forEach((cat) => {
        if (cat.level !== 0 && !visitedChildrenIds.has(cat._id?.toString())) {
          result.push(cat);
        }
      });

      return result;
    }

    if (sortBy === "level-asc") {
      return [...filtered].sort((a, b) => (a.level ?? 0) - (b.level ?? 0) || (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.name || "").localeCompare(b.name || ""));
    }

    if (sortBy === "level-desc") {
      return [...filtered].sort((a, b) => (b.level ?? 0) - (a.level ?? 0) || (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.name || "").localeCompare(b.name || ""));
    }

    if (sortBy === "sortOrder") {
      return [...filtered].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.name || "").localeCompare(b.name || ""));
    }

    if (sortBy === "name-asc") {
      return [...filtered].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    }

    if (sortBy === "name-desc") {
      return [...filtered].sort((a, b) => (b.name || "").localeCompare(a.name || ""));
    }

    if (sortBy === "latest") {
      return [...filtered].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }

    return filtered;
  }, [categoriesData, searchTerm, statusFilter, levelFilter, sortBy, parentCategoryMap]);

  const CategoryColumns = [
    { header: "#", accessor: "_index", render: (_, __, i) => i + 1 },
    {
      header: "Logo",
      accessor: "logo",
      render: (value, row) => {
        const firstGenderLogo = row.logos ? Object.values(row.logos).find(l => l?.url)?.url : null;
        const displayUrl = value?.url || firstGenderLogo;

        return (
          <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-white shadow-sm border border-gray-100 p-1">
            {displayUrl ? (
              <img src={displayUrl} alt="Logo" className="h-full w-full object-contain rounded-lg" />
            ) : (
              <span className="text-[10px] text-gray-400 font-medium">No Logo</span>
            )}
          </div>
        );
      },
    },
    {
      header: "Gender Logos",
      accessor: "logos",
      render: (logos) => {
        const genders = [
          { key: 'MEN', label: 'Men', color: 'bg-blue-50 text-blue-700 border-blue-200' },
          { key: 'WOMEN', label: 'Women', color: 'bg-purple-50 text-purple-700 border-purple-200' },
          { key: 'KIDS', label: 'Kids', color: 'bg-amber-50 text-amber-700 border-amber-200' },
          { key: 'BOYS', label: 'Boys', color: 'bg-sky-50 text-sky-700 border-sky-200' },
          { key: 'GIRLS', label: 'Girls', color: 'bg-pink-50 text-pink-700 border-pink-200' },
        ];

        const hasAny = genders.some(g => logos?.[g.key]?.url);
        if (!hasAny) {
          return <span className="text-[11px] text-gray-400 italic">None</span>;
        }

        return (
          <div className="flex items-center gap-1.5 flex-wrap max-w-[240px]">
            {genders.map(g => {
              const item = logos?.[g.key];
              if (!item?.url) return null;
              return (
                <div
                  key={g.key}
                  title={`${g.label} Logo`}
                  className="flex items-center gap-1 bg-white border border-gray-100 rounded-lg p-1 shadow-xs hover:shadow-sm transition-shadow"
                >
                  <img
                    src={item.url}
                    alt={g.label}
                    className="h-6 w-6 rounded object-contain bg-gray-50 border border-gray-100"
                  />
                  <span className={`text-[10px] font-semibold px-1 py-0.5 rounded border ${g.color}`}>
                    {g.label}
                  </span>
                </div>
              );
            })}
          </div>
        );
      },
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
    {
      header: "Name",
      accessor: "name",
      render: (value, row) => {
        if (row.level === 0) {
          return (
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900 text-sm tracking-tight">{value}</span>
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                Root
              </span>
            </div>
          );
        }
        const parentName = row.ancestors?.parentName || parentCategoryMap[row.parentId]?.name;
        return (
          <div className="flex items-center gap-2 pl-2">
            <span className="text-gray-300 font-mono text-sm">↳</span>
            <div className="flex flex-col">
              <span className="font-semibold text-gray-800">{value}</span>
              {parentName && (
                <span className="text-[11px] text-gray-400">
                  in <span className="text-gray-600 font-medium">{parentName}</span>
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    { header: "Slug", accessor: "slug", render: (value) => <span className="text-gray-500 text-xs font-mono bg-gray-50 px-2 py-1 rounded-md">{value}</span> },
    {
      header: "Level",
      accessor: "level",
      render: (value) => (
        <div className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${value === 0 ? 'bg-blue-500' : 'bg-purple-500'}`} />
          <span className="text-xs font-medium text-gray-700">
            {value === 0 ? 'Top Tier' : 'Sub Category'}
          </span>
        </div>
      )
    },
    {
      header: "Order",
      accessor: "sortOrder",
      render: (value) => (
        <span className="text-xs font-mono font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
          #{value ?? 0}
        </span>
      ),
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
            placeholder="Search across categories or parents..."
            className="h-12 border-none bg-transparent pl-12 shadow-none focus-visible:ring-0 text-gray-700 placeholder:text-gray-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4 lg:border-none lg:pt-0">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-gray-400" />
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-11 w-[165px] rounded-xl border-gray-100 bg-white shadow-sm ring-0 transition-all hover:bg-gray-50">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hierarchy">Tree (Grouped)</SelectItem>
                <SelectItem value="level-asc">Top Tier First</SelectItem>
                <SelectItem value="level-desc">Sub Category First</SelectItem>
                <SelectItem value="sortOrder">Sort Order (0-9)</SelectItem>
                <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                <SelectItem value="name-desc">Name (Z-A)</SelectItem>
                <SelectItem value="latest">Recent First</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-gray-400" />
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="h-11 w-[145px] rounded-xl border-gray-100 bg-white shadow-sm ring-0 transition-all hover:bg-gray-50">
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="0">Top Tier Only</SelectItem>
                <SelectItem value="1">Sub Categories Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-11 w-[130px] rounded-xl border-gray-100 bg-white shadow-sm ring-0 transition-all hover:bg-gray-50">
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
        data={filteredCategories}
        columns={CategoryColumns}
        actions={CategoryActions}
      />
    </div>
  );
}
