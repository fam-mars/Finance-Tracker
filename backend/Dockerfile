FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY . .
RUN dotnet publish -c Release -o /out

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /out .
# Persist state outside the container: docker run -v fo-data:/data ...
ENV Storage__DataDirectory=/data
ENV ASPNETCORE_URLS=http://0.0.0.0:5080
EXPOSE 5080
VOLUME ["/data"]
ENTRYPOINT ["dotnet", "FinancieelOverzicht.Api.dll"]
