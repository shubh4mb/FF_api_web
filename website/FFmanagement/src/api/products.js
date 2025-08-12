import axiosInstance from "@/utils/axios.config";

export const addBaseProduct = async (productData) => {
    try {
        const response = await axiosInstance.post('merchant/addBaseProduct', productData);
        return response.data;
    } catch (error) {
        if (error.response?.data?.errors?.length) {
          // Throw the first validation error as a string
          throw new Error(error.response.data.errors[0].message);
        } else if (error.response?.data?.message) {
          // Generic backend error message
          throw new Error(error.response.data.message);
        } else {
          throw new Error('Network or unknown error occurred.');
        }
      }
};

export const getBaseProducts = async () => {
    try {
        const response = await axiosInstance.get('admin/getBaseProducts');
        return response.data;
    } catch (error) {
        console.log(error)
        throw error.response ? error.response.data : new Error('Network Error');
    }
}

export const addVariant = async (productId,variantData) => {
    try {
      const formData = new FormData();
  
      // Append simple fields
      formData.append('name', variantData.name);
      formData.append('price', variantData.price);
      formData.append('mrp', variantData.mrp);
      formData.append('color', JSON.stringify(variantData.color));
      formData.append('sizes', JSON.stringify(variantData.sizes));
  
      // Append images
      console.log('variantData.images:', variantData.images);
      variantData.images.forEach((image) => {
        formData.append('images', image.file); // assuming `image.file` is a File/blob object
      });
  
      // Append main image separately if needed
    //   formData.append('mainImage', variantData.mainImage.file);
  
      // Send request
      const response = await axiosInstance.post(
        `admin/addVariant/${productId}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
  
      return response.data;
    } catch (error) {
      if (error.response?.data?.errors?.length) {
        throw new Error(error.response.data.errors[0].message);
      } else if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      } else {
        throw new Error('Network or unknown error occurred.');
      }
    }
  };
  

export const getBaseProductById = async (productId) => {
    try {
        const response = await axiosInstance.get(`admin/getBaseProductById/${productId}`);
        return response.data;
    } catch (error) {
        console.log(error)
        throw error.response ? error.response.data : new Error('Network Error');
    }
}


