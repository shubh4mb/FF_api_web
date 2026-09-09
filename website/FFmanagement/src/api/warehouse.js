import axiosInstance from "@/utils/axios.config";

// ── Warehouse CRUD ──
export const createWarehouse = async (data) => {
  const response = await axiosInstance.post("/admin/warehouse/create", data);
  return response.data;
};

export const getAllWarehouses = async (params = {}) => {
  const response = await axiosInstance.get("/admin/warehouse/all", { params });
  return response.data;
};

export const getWarehouseById = async (id) => {
  const response = await axiosInstance.get(`/admin/warehouse/${id}`);
  return response.data;
};

export const updateWarehouse = async (id, data) => {
  const response = await axiosInstance.patch(`/admin/warehouse/${id}`, data);
  return response.data;
};

export const deleteWarehouse = async (id) => {
  const response = await axiosInstance.delete(`/admin/warehouse/${id}`);
  return response.data;
};

// ── Warehouse Products ──
export const addWarehouseProduct = async (warehouseId, data) => {
  const response = await axiosInstance.post(`/admin/warehouse/${warehouseId}/products/add`, data);
  return response.data;
};

export const addWarehouseProductVariant = async (warehouseProductId, formData) => {
  const response = await axiosInstance.post(
    `/admin/warehouse/products/${warehouseProductId}/variants`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return response.data;
};

export const getWarehouseProducts = async (warehouseId, params = {}) => {
  const response = await axiosInstance.get(`/admin/warehouse/${warehouseId}/products`, { params });
  return response.data;
};

export const getWarehouseProductById = async (warehouseProductId) => {
  const response = await axiosInstance.get(`/admin/warehouse/products/${warehouseProductId}`);
  return response.data;
};

export const updateWarehouseProduct = async (warehouseProductId, data) => {
  const response = await axiosInstance.patch(`/admin/warehouse/products/${warehouseProductId}`, data);
  return response.data;
};

export const updateWarehouseProductStock = async (warehouseProductId, data) => {
  const response = await axiosInstance.patch(`/admin/warehouse/products/${warehouseProductId}/stock`, data);
  return response.data;
};

export const toggleWarehouseProductVerification = async (warehouseProductId) => {
  const response = await axiosInstance.patch(`/admin/warehouse/products/${warehouseProductId}/verify`);
  return response.data;
};

export const deleteWarehouseProduct = async (warehouseProductId) => {
  const response = await axiosInstance.delete(`/admin/warehouse/products/${warehouseProductId}`);
  return response.data;
};

// ── Warehouse Orders ──
export const getAllWarehouseOrders = async (params = {}) => {
  const response = await axiosInstance.get("/admin/warehouse/orders", { params });
  return response.data;
};

export const getWarehouseOrderById = async (orderId) => {
  const response = await axiosInstance.get(`/admin/warehouse/orders/${orderId}`);
  return response.data;
};

export const updateWarehouseOrderStatus = async (orderId, data) => {
  const response = await axiosInstance.patch(`/admin/warehouse/orders/${orderId}/status`, data);
  return response.data;
};

export const acceptWarehouseOrderAdmin = async (orderId) => {
  const response = await axiosInstance.patch(`/admin/warehouse/orders/${orderId}/accept`);
  return response.data;
};

export const rejectWarehouseOrderAdmin = async (orderId, reason) => {
  const response = await axiosInstance.patch(`/admin/warehouse/orders/${orderId}/reject`, { reason });
  return response.data;
};

export const packWarehouseOrderAdmin = async (orderId) => {
  const response = await axiosInstance.patch(`/admin/warehouse/orders/${orderId}/pack`);
  return response.data;
};

export const settleWarehouseOrder = async (orderId) => {
  const response = await axiosInstance.post(`/admin/warehouse/orders/${orderId}/settle`);
  return response.data;
};

export const getWarehouseOrderStats = async (params = {}) => {
  const response = await axiosInstance.get("/admin/warehouse/orders/stats", { params });
  return response.data;
};

// ── Warehouse Operator ──
export const createWarehouseOperator = async (warehouseId, data) => {
  const response = await axiosInstance.post(`/admin/warehouse/${warehouseId}/operator`, data);
  return response.data;
};
