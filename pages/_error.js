import Error from "next/error";

const CustomErrorComponent = (props) => {
  return <Error statusCode={props.statusCode} />;
};

CustomErrorComponent.getInitialProps = async (contextData) => {
  // Simple error handling without external services
  console.error('Application error:', {
    statusCode: contextData.res?.statusCode,
    hasError: !!contextData.err,
    url: contextData.req?.url,
    userAgent: contextData.req?.headers?.['user-agent']
  });

  // Return the standard error props
  return Error.getInitialProps(contextData);
};

export default CustomErrorComponent; 
